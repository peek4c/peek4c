import axios from 'axios';
import * as FileSystem from 'expo-file-system/legacy';
import { getCachedRequest, saveCachedRequest } from '../database/db';

const BASE_URL = 'https://a.4cdn.org';

// Priority queue system for media downloads
const MAX_CONCURRENT_IMAGE_DOWNLOADS = 4;
const MIN_CONCURRENT_IMAGE_DOWNLOADS = 1;

let activeImageDownloadsCount = 0;
let activeHighPriorityDownloadsCount = 0;

interface DownloadRequest {
    url: string;
    resolve: (uri: string) => void;
    reject: (error: any) => void;
    type: 'image' | 'video';
    isHighPriority: boolean;
    context?: string;
}

const imageNormalQueue: DownloadRequest[] = [];
const activeDownloads = new Map<string, Promise<string>>();

const isImage = (url: string): boolean => {
    const ext = url.split('.').pop()?.toLowerCase();
    return ext === 'jpg' || ext === 'jpeg' || ext === 'png' || ext === 'gif' || ext === 'webp';
};

const getDynamicImageLimit = () => {
    if (activeHighPriorityDownloadsCount > 0) {
        return MIN_CONCURRENT_IMAGE_DOWNLOADS;
    }
    return MAX_CONCURRENT_IMAGE_DOWNLOADS;
};

const processImageQueue = () => {
    const dynamicLimit = getDynamicImageLimit();
    console.log(`[Proxy] Processing queue. Active: ${activeImageDownloadsCount}, Limit: ${dynamicLimit}, Queue Length: ${imageNormalQueue.length}`);

    while (activeImageDownloadsCount < dynamicLimit) {
        const request = imageNormalQueue.shift();
        if (!request) {
            break;
        }
        activeImageDownloadsCount++;
        executeDownload(request);
    }
};

const executeDownload = async (request: DownloadRequest) => {
    const { url, resolve, reject, type, isHighPriority, context } = request;
    const isImg = type === 'image';
    const contextStr = context ? `[Context: ${context}]` : '';

    try {
        console.log(`[Proxy] Starting download ${contextStr}: ${url} (Priority: ${isHighPriority ? 'High' : 'Normal'})`);
        const filename = url.split('/').pop();
        const cacheDir = (FileSystem as any).cacheDirectory || (FileSystem as any).documentDirectory;
        const fileUri = `${cacheDir}${filename}`;

        // FileSystem.downloadAsync streams directly to the file system
        const { uri } = await FileSystem.downloadAsync(url, fileUri);

        // Save mapping to SQLite
        await saveCachedRequest(url, uri);
        console.log(`[Proxy] Download success ${contextStr}: ${url}`);

        resolve(uri);
    } catch (error) {
        console.error(`[Proxy] ${type} download error ${contextStr}:`, error);
        reject(error);
    } finally {
        // Remove from active downloads
        activeDownloads.delete(url);

        if (isHighPriority) {
            activeHighPriorityDownloadsCount--;
            // High priority finished, potentially releasing slots for normal queue
            processImageQueue();
        } else if (isImg) {
            activeImageDownloadsCount--;
            processImageQueue();
        }
        // Normal video downloads don't affect queues/counters
    }
};

export const fetchJson = async <T>(endpoint: string, ttlSeconds: number = 300): Promise<T> => {
    const url = `${BASE_URL}${endpoint}`;
    console.log(`[Proxy] Fetching JSON: ${url}`);
    const cached = await getCachedRequest(url);

    if (cached) {
        const age = (Date.now() - cached.timestamp) / 1000;
        console.log(`[Proxy] Found cache for ${url}, age: ${age}s`);
        if (age < ttlSeconds) {
            try {
                console.log(`[Proxy] Returning cached data for ${url}`);
                return JSON.parse(cached.data) as T;
            } catch (e) {
                console.error('[Proxy] Error parsing cached JSON', e);
            }
        } else {
            console.log(`[Proxy] Cache expired for ${url}`);
        }
    }

    try {
        console.log(`[Proxy] sending network request to ${url}`);
        const response = await axios.get(url);
        const data = response.data;
        console.log(`[Proxy] Received data for ${url}, length: ${JSON.stringify(data).length}`);
        await saveCachedRequest(url, JSON.stringify(data));
        return data as T;
    } catch (error) {
        console.error('[Proxy] Fetch error:', error);
        if (cached) {
            console.log(`[Proxy] Fallback to stale cache for ${url}`);
            // Fallback to stale cache if fetch fails
            return JSON.parse(cached.data) as T;
        }
        throw error;
    }
};

export const getMediaUri = async (url: string, context?: string): Promise<string> => {
    return getMediaUriWithPriority(url, false, context);
};

export const getMediaUriWithPriority = async (url: string, isHighPriority: boolean = false, context?: string): Promise<string> => {
    const contextStr = context ? `[Context: ${context}]` : '';
    // Check if we have a cached mapping
    const cached = await getCachedRequest(url);
    if (cached) {
        const localUri = cached.data;
        const info = await FileSystem.getInfoAsync(localUri);
        if (info.exists) {
            // console.log(`[Proxy] Cache hit ${contextStr}: ${url}`);
            return localUri;
        }
    }

    // Check if this URL is already being downloaded
    const existingDownload = activeDownloads.get(url);
    if (existingDownload) {
        console.log(`[Proxy] Reusing existing download ${contextStr}: ${url}`);
        try {
            return await existingDownload;
        } catch (error) {
            console.error('[Proxy] Reused download failed:', error);
            return url;
        }
    }

    // Create a new download promise
    const downloadPromise = new Promise<string>((resolve, reject) => {
        const type = isImage(url) ? 'image' : 'video';
        const request: DownloadRequest = { url, resolve, reject, type, isHighPriority, context };

        if (isHighPriority) {
            // High priority: execute immediately, ignore limits
            console.log(`[Proxy] High priority download starting ${contextStr}: ${url}`);
            activeHighPriorityDownloadsCount++;
            executeDownload(request);
        } else {
            // Normal priority
            if (type === 'image') {
                const dynamicLimit = getDynamicImageLimit();
                if (activeImageDownloadsCount < dynamicLimit) {
                    activeImageDownloadsCount++;
                    executeDownload(request);
                } else {
                    console.log(`[Proxy] Queuing normal image download ${contextStr}: ${url}. Queue size: ${imageNormalQueue.length + 1}`);
                    imageNormalQueue.push(request);
                }
            } else {
                // Video (Normal): No queue, execute immediately
                executeDownload(request);
            }
        }
    });

    // Store in active downloads to prevent duplicates
    activeDownloads.set(url, downloadPromise);

    try {
        const uri = await downloadPromise;
        return uri;
    } catch (error) {
        console.error('[Proxy] Download failed:', error);
        return url; // Fallback to remote URL
    }
};

export const clearDownloadQueue = (context: string) => {
    if (!context) return;

    console.log(`[Proxy] Attempting to clear queue for context: ${context}`);
    let removedCount = 0;
    // Iterate backwards to safely remove items
    for (let i = imageNormalQueue.length - 1; i >= 0; i--) {
        if (imageNormalQueue[i].context === context) {
            imageNormalQueue.splice(i, 1);
            removedCount++;
        }
    }

    if (removedCount > 0) {
        console.log(`[Proxy] Cleared ${removedCount} items from download queue for context: ${context}`);
    } else {
        console.log(`[Proxy] No items found to clear for context: ${context}`);
    }
};

export const clearImageCache = async () => {
    try {
        const cacheDir = (FileSystem as any).cacheDirectory || (FileSystem as any).documentDirectory;
        if (cacheDir) {
            const files = await FileSystem.readDirectoryAsync(cacheDir);
            for (const file of files) {
                await FileSystem.deleteAsync(cacheDir + file, { idempotent: true });
            }
        }
        console.log('[Proxy] Image cache cleared');
    } catch (error) {
        console.error('[Proxy] Error clearing image cache:', error);
    }
};
