import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet, Text, useWindowDimensions } from 'react-native';
import PagerView from 'react-native-pager-view';
import { fetchJson } from '../services/proxy';
import { ThreadPost, Thread } from '../types';
import ThreadItem from './ThreadItem';
import { addToHistory, getRecommendedItems, saveThreads, isThreadFullyLoaded, getHistoryNos, updateThreadLastFetched, getFollowedUnreadThreads, getFollowing, getFollowedThreadsNeedingUpdate } from '../database/db';
import { filterPostsByKeywords } from '../database/db';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { rateLimiter } from '../services/rateLimiter';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

interface Props {
    board: string;
    isActiveTab: boolean;
    workSafeEnabled?: boolean;
    isCleanMode?: boolean;
    onToggleCleanMode?: (isClean: boolean) => void;
}

export default function FeedView({ board, isActiveTab, workSafeEnabled = false, isCleanMode = false, onToggleCleanMode }: Props) {
    const [threads, setThreads] = useState<ThreadPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeIndex, setActiveIndex] = useState(0);
    const [preloadWindow, setPreloadWindow] = useState(2);
    const [emptyMessage, setEmptyMessage] = useState<string | null>(null);
    const { height: screenHeight, width: screenWidth } = useWindowDimensions();
    const pagerRef = useRef<PagerView>(null);


    const navigation = useNavigation<any>();
    const isFocused = useIsFocused();

    // Pagination state
    const [excludeIds, setExcludeIds] = useState<number[]>([]);
    const [hasMore, setHasMore] = useState(true);
    const LIMIT = 20;

    // Queue state
    const fetchQueue = useRef<Set<number>>(new Set());
    const isProcessingQueue = useRef(false);
    const mounted = useRef(true);

    useEffect(() => {
        mounted.current = true;
        loadInitialData();
        return () => {
            mounted.current = false;
        };
    }, [board, workSafeEnabled]);

    useEffect(() => {
        if (isActiveTab && board === '__FOLLOW__') {
            loadInitialData();
        }
    }, [isActiveTab]);

    // Cleanup Clean Mode when switching tabs
    useEffect(() => {
        if (!isActiveTab && isCleanMode && onToggleCleanMode) {
            onToggleCleanMode(false);
        }
    }, [isActiveTab, isCleanMode, onToggleCleanMode]);

    const updateFollowedThreadsInBackground = async () => {
        try {
            const opsToUpdate = await getFollowedThreadsNeedingUpdate();

            if (opsToUpdate.length > 0) {
                console.log(`[FeedView] Updating ${opsToUpdate.length} followed threads...`);

                for (const op of opsToUpdate) {
                    try {
                        await rateLimiter.throttle(async () => {
                            const threadData = await fetchJson<{ posts: Thread[] }>(`/${op.board}/thread/${op.no}.json`);
                            if (threadData && threadData.posts) {
                                const posts: ThreadPost[] = threadData.posts.map(p => ({
                                    ...p,
                                    board: op.board,
                                    resto: p.resto || 0
                                }));
                                // Filter posts by blocked keywords before saving
                                const filteredPosts = await filterPostsByKeywords(posts);
                                await saveThreads(filteredPosts);
                                await updateThreadLastFetched(op.no, op.board);
                            }
                        });
                    } catch (e) {
                        console.warn(`[FeedView] Failed to update thread ${op.no}:`, e);
                    }
                }
            }
        } catch (e) {
            console.error('[FeedView] Error updating followed threads:', e);
        }
    };

    const loadInitialData = async () => {
        console.log(`[FeedView] Loading initial data for board: ${board}`);
        setLoading(true);
        setLoading(true);
        setExcludeIds([]);
        setThreads([]);
        setEmptyMessage(null);

        // Follow mode
        if (board === '__FOLLOW__') {
            try {
                // 1. Get initial batch of unread items (20 items)
                const unreadItems = await getFollowedUnreadThreads(workSafeEnabled, LIMIT, []);

                if (unreadItems.length > 0) {
                    setThreads(unreadItems);
                    setExcludeIds(unreadItems.map(item => item.no));

                    // If we got less than LIMIT items, trigger auto-update in background
                    if (unreadItems.length < LIMIT) {
                        console.log(`[FeedView] Got ${unreadItems.length} items, less than ${LIMIT}, checking for updates...`);
                        updateFollowedThreadsInBackground();
                    }
                } else {
                    // 2. No unread items, check if user has any follows
                    const followedOps = await getFollowing();

                    if (followedOps.length === 0) {
                        setEmptyMessage('Follow some threads to see them here');
                    } else {
                        // 3. Trigger auto-update
                        setEmptyMessage('Checking for updates...');
                        await updateFollowedThreadsInBackground();

                        // 4. Reload unread items after updating
                        const newUnreadItems = await getFollowedUnreadThreads(workSafeEnabled, LIMIT, []);
                        if (newUnreadItems.length > 0) {
                            setThreads(newUnreadItems);
                            setExcludeIds(newUnreadItems.map(item => item.no));
                            setEmptyMessage(null);
                        } else {
                            setEmptyMessage('No new posts in followed threads');
                        }
                    }
                }
            } catch (e) {
                console.error('[FeedView] Error loading Follow data', e);
                setEmptyMessage('Error loading followed threads');
            } finally {
                if (mounted.current) setLoading(false);
            }
            return;
        }

        // Normal board mode
        try {
            // 1. Fetch Catalog (OPs only)
            const pages = await fetchJson<{ page: number; threads: Thread[] }[]>(`/${board}/catalog.json`, 300);

            // 2. Save OPs to DB
            const ops: ThreadPost[] = [];
            pages.forEach(page => {
                page.threads.forEach(thread => {
                    if (thread.tim && thread.ext) {
                        ops.push({ ...thread, board, resto: 0 });
                    }
                });
            });
            // Filter OPs by blocked keywords before saving to DB
            const filteredOps = await filterPostsByKeywords(ops);

            // 获取所有 ops 中的 no，然后批量在 history 查询是否已经存在，将存在的过滤掉，过滤后入 size = 0，就调用 loadMoreFromDB 获取新数据    
            const nos = filteredOps.map(op => op.no);
            const historyNos = await getHistoryNos(board, nos);
            const newOps = filteredOps.filter(op => !historyNos.includes(op.no));
            if (newOps.length === 0) {
                console.log(`[FeedView] No new OPs found for board: ${board}`);
                await loadMoreFromDB([]);
            } else {
                console.log(`[FeedView] Found ${newOps.length} new OPs for board: ${board}`);
                await saveThreads(newOps);
                setThreads(newOps);
                setExcludeIds(newOps.map(op => op.no));
            }
        } catch (e) {
            console.error('[FeedView] Error loading initial data', e);
        } finally {
            if (mounted.current) setLoading(false);
        }
    };

    const loadMoreFromDB = async (currentExcludeIds: number[]) => {
        try {
            const newItems = await getRecommendedItems(board, LIMIT, currentExcludeIds);
            if (mounted.current) {
                if (newItems.length > 0) {
                    console.log(`[FeedView] Found ${newItems.length} new items from DB for board: ${board}`);
                    setThreads(prev => {
                        const combined = [...prev, ...newItems];
                        // Update excludeIds with new items
                        const newIds = newItems.map(i => i.no);
                        setExcludeIds(prevIds => [...prevIds, ...newIds]);
                        return combined;
                    });
                } else {
                    setHasMore(false);
                }
            }
        } catch (e) {
            console.error('[FeedView] Error loading from DB', e);
        }
    };

    const processQueue = async () => {
        if (isProcessingQueue.current || fetchQueue.current.size === 0) return;
        isProcessingQueue.current = true;

        try {
            while (fetchQueue.current.size > 0 && mounted.current) {
                // Get first item from set (iteration order is insertion order)
                const threadId = fetchQueue.current.values().next().value;
                if (threadId === undefined) break;
                fetchQueue.current.delete(threadId);

                try {
                    console.log(`[FeedView] Processing queue item: ${threadId}`);
                    // Throttle requests to 1 per second
                    await rateLimiter.throttle(async () => {
                        const threadData = await fetchJson<{ posts: Thread[] }>(`/${board}/thread/${threadId}.json`);
                        if (threadData && threadData.posts) {
                            const posts: ThreadPost[] = threadData.posts.map(p => ({
                                ...p,
                                board,
                                resto: p.resto || 0
                            }));
                            // Filter posts by blocked keywords before saving
                            const filteredPosts = await filterPostsByKeywords(posts);
                            await saveThreads(filteredPosts);
                            await updateThreadLastFetched(threadId, board);
                            console.log(`[FeedView] Fetched and saved thread ${threadId}`);
                        }
                    });
                } catch (e) {
                    console.warn(`[FeedView] Failed to fetch thread ${threadId}:`, e);
                }
            }
        } finally {
            isProcessingQueue.current = false;
        }
    };

    const handlePageSelected = (e: any) => {
        const newIndex = e.nativeEvent.position;
        setActiveIndex(newIndex);

        setPreloadWindow(2); // Keep preload window small and fixed to prevent OOM

        // Add to history
        const item = threads[newIndex];
        if (item) {
            if (item.tim && item.ext) {
                addToHistory(item);
            }

            // Lazy Load Logic: If it's an OP and not fully loaded, add to queue
            if (item.resto === 0) {
                isThreadFullyLoaded(item.no, board).then(loaded => {
                    if (!loaded && !fetchQueue.current.has(item.no)) {
                        console.log(`[FeedView] Queueing thread ${item.no} for fetch`);
                        fetchQueue.current.add(item.no);
                        processQueue();
                    }
                });
            }
        }

        // Load more when approaching end
        if (newIndex >= threads.length - 3 && hasMore && !loading) {
            handleEndReached();
        }
    };

    const handleEndReached = async () => {
        if (loading || !hasMore) return;

        // Follow mode pagination
        if (board === '__FOLLOW__') {
            console.log(`[FeedView] Follow mode: Loading more, current count=${threads.length}, excludeIds=${excludeIds.length}`);

            try {
                const moreItems = await getFollowedUnreadThreads(workSafeEnabled, LIMIT, excludeIds);

                if (moreItems.length > 0) {
                    console.log(`[FeedView] Follow mode: Loaded ${moreItems.length} more items`);
                    setThreads(prev => [...prev, ...moreItems]);
                    setExcludeIds(prev => [...prev, ...moreItems.map(item => item.no)]);

                    // If we got less than LIMIT items, trigger auto-update in background
                    if (moreItems.length < LIMIT) {
                        console.log(`[FeedView] Got ${moreItems.length} items, less than ${LIMIT}, triggering auto-update...`);
                        updateFollowedThreadsInBackground();
                    }
                } else {
                    console.log(`[FeedView] Follow mode: No more unread items, triggering auto-update...`);
                    setHasMore(false);
                    // Trigger auto-update when no more unread items
                    updateFollowedThreadsInBackground();
                }
            } catch (e) {
                console.error('[FeedView] Error loading more Follow items:', e);
            }
            return;
        }

        // Normal board mode
        loadMoreFromDB(excludeIds);
    };

    const handleNavigateToDetail = (thread: ThreadPost) => {
        const threadToPass = thread.opThread || thread;
        navigation.navigate('ThreadDetail', { thread: threadToPass });
    };

    if (loading && threads.length === 0) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#ff0050" />
                {emptyMessage && <Text style={styles.emptyText}>{emptyMessage}</Text>}
            </View>
        );
    }

    if (!loading && threads.length === 0 && emptyMessage) {
        return (
            <View style={styles.center}>
                <Text style={styles.emptyText}>{emptyMessage}</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <PagerView
                ref={pagerRef}
                style={styles.pager}
                initialPage={0}
                orientation="vertical"
                onPageSelected={handlePageSelected}
                overdrag={true}
            >
                {threads.map((item, index) => {
                    // Lazy rendering: only render items within a reasonable range
                    // This prevents memory accumulation during long browsing sessions
                    const RENDER_WINDOW = 5; // Render current ±5 items (11 total)
                    const shouldRender = Math.abs(index - activeIndex) <= RENDER_WINDOW;

                    return (
                        <View key={`${item.board}-${item.no}`} style={styles.page}>
                            {shouldRender ? (
                                <FeedItemWrapper
                                    thread={item}
                                    opThread={item.opThread || item}
                                    isActive={index === activeIndex && isActiveTab && isFocused}
                                    shouldLoad={Math.abs(index - activeIndex) <= preloadWindow}
                                    onNavigate={() => handleNavigateToDetail(item)}
                                    itemHeight={screenHeight}
                                    itemWidth={screenWidth}
                                    isCleanMode={isCleanMode}
                                    onToggleCleanMode={onToggleCleanMode || (() => { })}

                                />
                            ) : (
                                <View style={{ width: screenWidth, height: screenHeight, backgroundColor: '#000' }} />
                            )}
                        </View>
                    );
                })}
            </PagerView>
        </View>
    );
}

function FeedItemWrapper({ thread, opThread, isActive, shouldLoad, onNavigate, itemHeight, itemWidth, isCleanMode, onToggleCleanMode }: { thread: ThreadPost; opThread: ThreadPost; isActive: boolean; shouldLoad: boolean; onNavigate: () => void; itemHeight: number; itemWidth: number; isCleanMode: boolean; onToggleCleanMode: (isClean: boolean) => void }) {
    // Use react-native-gesture-handler for consistent gesture handling
    const panGesture = Gesture.Pan()
        .activeOffsetX(-20) // Only activate when swiping left at least 20px
        .failOffsetX(20)    // Fail if swiping right
        .failOffsetY([-20, 20]) // Fail if vertical movement is too large
        .onEnd((event) => {
            'worklet';
            // If swiped left more than 50px, navigate
            if (event.translationX < -50) {
                runOnJS(onNavigate)();
            }
        });

    return (
        <GestureDetector gesture={panGesture}>
            <View style={{ width: itemWidth, height: itemHeight }}>
                <ThreadItem
                    thread={thread}
                    opThread={opThread}
                    isActive={isActive}
                    shouldLoad={shouldLoad}
                    shouldLoadVideo={isActive} // Only load video for the active item to prevent OOM
                    onPressAvatar={onNavigate}
                    isCleanMode={isCleanMode}
                    onToggleCleanMode={onToggleCleanMode}

                />
            </View>
        </GestureDetector>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    pager: {
        flex: 1,
    },
    page: {
        flex: 1,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#000',
    },
    emptyText: {
        color: '#888',
        fontSize: 16,
        marginTop: 20,
        textAlign: 'center',
        paddingHorizontal: 40,
    },
});
