/**
 * Peek4c - 4chan Browser App
 * Copyright (c) 2025 Peek4c Contributors
 * 
 * This software is provided under the GPLv3 License.
 * See LICENSE file for details.
 * 
 * DISCLAIMER: This is an educational project. Users are responsible
 * for their own use of this application and the content they access.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, Image, Dimensions, useWindowDimensions } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ScreenOrientation from 'expo-screen-orientation';
import { getHistory, getStars, getFollowing, clearHistory, clearCache, toggleFollow, getHistoryBoards, getBlockedItems, toggleBlock, isBlocked } from '../database/db';
import BlockedKeywordsView from '../components/BlockedKeywordsView';
import { ThreadPost } from '../types';
import { Ionicons } from '@expo/vector-icons';
import { getMediaUri } from '../services/proxy';
import * as FileSystem from 'expo-file-system/legacy';
import { followEvents } from '../services/followEvents';
import { clearVideoCacheAsync, getCurrentVideoCacheSize } from 'expo-video';
import NetInfo from '@react-native-community/netinfo';



type Tab = 'Following' | 'Stars' | 'History';

export default function MeScreen({ navigation }: any) {
    const [activeTab, setActiveTab] = useState<Tab>('Following');
    const [data, setData] = useState<ThreadPost[]>([]);
    const [cacheInfo, setCacheInfo] = useState('Calculating...');
    const [isOffline, setIsOffline] = useState(false);

    // History filter states
    const [filterOpOnly, setFilterOpOnly] = useState(false);
    const [filterBoard, setFilterBoard] = useState<string | null>(null);
    const [availableBoards, setAvailableBoards] = useState<string[]>([]);
    const [showFilterMenu, setShowFilterMenu] = useState(false);

    // Following filter states
    const [followFilter, setFollowFilter] = useState<'Following' | 'Blocked' | 'Keywords'>('Following');
    const [showFollowFilter, setShowFollowFilter] = useState(false);

    const [hasMore, setHasMore] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const { width, height } = useWindowDimensions();
    const isLandscape = width > height;
    const GRID_COLUMNS = isLandscape ? 6 : 3;
    const THUMBNAIL_SIZE = (width - 40) / GRID_COLUMNS;

    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener(state => {
            setIsOffline(state.isConnected === false);
        });

        return () => {
            unsubscribe();
        };
    }, []);

    // Refresh data when screen comes into focus
    useFocusEffect(
        useCallback(() => {
            loadData(true);
            if (activeTab === 'History') {
                getCacheInfo();
            }
        }, [activeTab, filterOpOnly, filterBoard, followFilter])
    );

    // Reload data when filter changes
    useEffect(() => {
        if (activeTab === 'History' || activeTab === 'Following') {
            loadData(true);
        }
    }, [filterOpOnly, filterBoard, followFilter]);

    const getCacheInfo = async () => {
        try {
            // Get proxy.ts cache (images/thumbnails)
            const cacheDir = (FileSystem as any).cacheDirectory;
            let proxyCacheSize = 0;
            let proxyCacheCount = 0;

            if (cacheDir) {
                const files = await FileSystem.readDirectoryAsync(cacheDir);
                for (const file of files) {
                    try {
                        const fileInfo = await FileSystem.getInfoAsync(cacheDir + file);
                        if (fileInfo.exists && !fileInfo.isDirectory) {
                            proxyCacheSize += (fileInfo as any).size || 0;
                            proxyCacheCount++;
                        }
                    } catch (e) {
                        // Skip files that can't be read
                    }
                }
            }

            // Get expo-video cache (videos)
            let videoCacheSize = 0;
            try {
                videoCacheSize = await getCurrentVideoCacheSize();
            } catch (e) {
                console.error('[MeScreen] Error getting video cache size:', e);
            }

            const totalSizeMB = ((proxyCacheSize + videoCacheSize) / (1024 * 1024)).toFixed(2);
            const proxySizeMB = (proxyCacheSize / (1024 * 1024)).toFixed(2);
            const videoSizeMB = (videoCacheSize / (1024 * 1024)).toFixed(2);

            setCacheInfo(
                `Total: ${totalSizeMB} MB\n` +
                `Images: ${proxyCacheCount} files (${proxySizeMB} MB)\n` +
                `Videos: ${videoSizeMB} MB`
            );
        } catch (e) {
            console.error('[MeScreen] Error getting cache info:', e);
            setCacheInfo('Cache: Error calculating');
        }
    };

    const loadData = async (reset: boolean = false) => {
        try {
            let result: ThreadPost[] = [];
            if (activeTab === 'Following') {
                if (followFilter === 'Following') {
                    result = await getFollowing();
                } else {
                    result = await getBlockedItems();
                }
                setData(result);
            } else if (activeTab === 'Stars') {
                result = await getStars();
                setData(result);
            } else if (activeTab === 'History') {
                const offset = reset ? 0 : data.length;
                result = await getHistory(50, offset, filterOpOnly, filterBoard || undefined);

                if (reset || availableBoards.length === 0) {
                    const boards = await getHistoryBoards(3);
                    setAvailableBoards(boards);
                }

                if (reset) {
                    setData(result);
                } else {
                    setData(prev => [...prev, ...result]);
                }

                setHasMore(result.length === 50);
            } else {
                setData(result);
            }
        } catch (e) {
            console.error('[MeScreen] Error loading data:', e);
        }
    };

    const loadMore = async () => {
        if (activeTab !== 'History' || isLoadingMore || !hasMore) return;
        setIsLoadingMore(true);
        await loadData(false);
        setIsLoadingMore(false);
    };

    const getFilterLabel = () => {
        let label = 'History';
        if (filterOpOnly) {
            label = `OP/${label}`;
        }
        if (filterBoard) {
            label = `/${filterBoard}/${label}`;
        }
        if (label !== 'History') {
            label = label.replace('/History', '');
        }
        return label;
    };

    const handleFilterChange = (opOnly: boolean, board: string | null) => {
        setFilterOpOnly(opOnly);
        setFilterBoard(board);
        setShowFilterMenu(false);
    };

    const handleClearHistory = async () => {
        await clearHistory();
        setHasMore(true);
        loadData(true);
        Alert.alert('Success', 'History cleared');
    };

    const handleClearCache = async () => {
        // Clear database cache mappings
        await clearCache();

        try {
            // Clear proxy.ts cache (images/thumbnails)
            const { clearImageCache } = await import('../services/proxy');
            await clearImageCache();

            // Clear expo-video cache (videos)
            await clearVideoCacheAsync();
        } catch (e) {
            console.error('[MeScreen] Error clearing cache:', e);
        }

        getCacheInfo();
        Alert.alert('Success', 'All caches cleared (images + videos)');
    };

    const handleItemPress = (item: ThreadPost) => {
        console.log('[MeScreen] handleItemPress', { activeTab, itemNo: item.no });
        if (activeTab === 'Stars' || activeTab === 'History') {
            // Find index of item in data
            const index = data.findIndex(d => d.board === item.board && d.no === item.no);
            console.log('[MeScreen] Navigating to MediaList', { index, totalItems: data.length });

            // Limit data to prevent OOM: only pass a window of items around the clicked item
            const WINDOW_SIZE = 20; // Only load 20 items at a time
            const halfWindow = Math.floor(WINDOW_SIZE / 2);
            const startIndex = Math.max(0, index - halfWindow);
            const endIndex = Math.min(data.length, index + halfWindow);
            const windowedData = data.slice(startIndex, endIndex);
            const adjustedIndex = index - startIndex; // Adjust index for the windowed data

            console.log('[MeScreen] Window:', { startIndex, endIndex, windowSize: windowedData.length, adjustedIndex });
            navigation.navigate('MediaList', {
                threads: windowedData,
                initialIndex: adjustedIndex
            });
        } else {
            console.log('[MeScreen] Navigating to ThreadDetail');
            navigation.navigate('ThreadDetail', { thread: item });
        }
    };

    const handleToggleFollow = async (item: ThreadPost) => {
        await toggleFollow(item);
        // Check new state and notify
        const { isFollowing } = await import('../database/db');
        const newFollowState = await isFollowing(item.no, item.board);
        followEvents.notifyFollowChanged(item.no, item.board, newFollowState);
        // Reload data to update the list
        loadData();
    };

    const handleToggleBlock = async (item: ThreadPost) => {
        await toggleBlock(item);
        // Reload data
        loadData();
    };

    const renderItem = ({ item }: { item: ThreadPost }) => {
        if (activeTab === 'Following') {
            return (
                <FollowingItem
                    item={item}
                    isBlocked={followFilter === 'Blocked'}
                    onToggleAction={() => followFilter === 'Blocked' ? handleToggleBlock(item) : handleToggleFollow(item)}
                    onPress={() => handleItemPress(item)}
                />
            );
        }
        return <ThumbnailItem item={item} onPress={() => handleItemPress(item)} thumbnailSize={THUMBNAIL_SIZE} />;
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Me</Text>
                <TouchableOpacity onPress={() => navigation.navigate('Legal', { type: 'about' })}>
                    <Text style={styles.aboutButtonText}>About</Text>
                </TouchableOpacity>
            </View>

            {isOffline && (
                <View style={styles.offlineBanner}>
                    <Ionicons name="cloud-offline-outline" size={16} color="#fff" />
                    <Text style={styles.offlineText}>Offline Mode - Showing Cached Data</Text>
                </View>
            )}

            <View style={styles.tabs}>

                <TouchableOpacity
                    style={[styles.tab, activeTab === 'Following' && styles.activeTab, { flexDirection: 'row', justifyContent: 'center' }]}
                    onPress={() => {
                        if (activeTab !== 'Following') {
                            setActiveTab('Following');
                        } else {
                            setShowFollowFilter(!showFollowFilter);
                        }
                    }}
                >
                    <Text style={[styles.tabText, activeTab === 'Following' && styles.activeTabText]}>{followFilter}</Text>
                    <Ionicons name={showFollowFilter ? "chevron-up" : "chevron-down"} size={14} color={activeTab === 'Following' ? "#fff" : "#888"} style={{ marginLeft: 4 }} />
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.tab, activeTab === 'Stars' && styles.activeTab]}
                    onPress={() => setActiveTab('Stars')}
                >
                    <Text style={[styles.tabText, activeTab === 'Stars' && styles.activeTabText]}>Stars</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'History' && styles.activeTab, styles.historyTab]}
                    onPress={async () => {
                        if (activeTab !== 'History') {
                            setActiveTab('History');
                            // Load board data
                            if (availableBoards.length === 0) {
                                const boards = await getHistoryBoards(3);
                                setAvailableBoards(boards);
                            }
                        } else {
                            setShowFilterMenu(!showFilterMenu);
                        }
                    }}
                >
                    <Text style={[styles.tabText, activeTab === 'History' && styles.activeTabText, { fontSize: 11 }]} numberOfLines={1}>
                        {getFilterLabel()}
                    </Text>
                    <Ionicons name={showFilterMenu ? "chevron-up" : "chevron-down"} size={14} color={activeTab === 'History' ? "#fff" : "#888"} style={{ marginLeft: 4 }} />
                </TouchableOpacity>
            </View>

            {activeTab === 'History' && showFilterMenu && (
                <View style={styles.filterMenu}>
                    <View style={styles.filterSection}>
                        <Text style={styles.filterSectionTitle}>Filter Type</Text>
                        <TouchableOpacity
                            style={styles.filterMenuItem}
                            onPress={() => handleFilterChange(false, filterBoard)}
                        >
                            <Text style={styles.filterMenuText}>ALL</Text>
                            {!filterOpOnly && (
                                <Ionicons name="checkmark" size={20} color="#ff0050" />
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.filterMenuItem}
                            onPress={() => handleFilterChange(true, filterBoard)}
                        >
                            <Text style={styles.filterMenuText}>OP</Text>
                            {filterOpOnly && (
                                <Ionicons name="checkmark" size={20} color="#ff0050" />
                            )}
                        </TouchableOpacity>
                    </View>

                    {availableBoards.length > 0 && (
                        <View style={styles.filterSection}>
                            <Text style={styles.filterSectionTitle}>Filter Board (Optional)</Text>
                            <TouchableOpacity
                                style={styles.filterMenuItem}
                                onPress={() => handleFilterChange(filterOpOnly, null)}
                            >
                                <Text style={styles.filterMenuText}>Any Board</Text>
                                {!filterBoard && (
                                    <Ionicons name="checkmark" size={20} color="#ff0050" />
                                )}
                            </TouchableOpacity>
                            {availableBoards.map(board => (
                                <TouchableOpacity
                                    key={board}
                                    style={styles.filterMenuItem}
                                    onPress={() => handleFilterChange(filterOpOnly, board)}
                                >
                                    <Text style={styles.filterMenuText}>/{board}/</Text>
                                    {filterBoard === board && (
                                        <Ionicons name="checkmark" size={20} color="#ff0050" />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                </View>
            )}

            {activeTab === 'Following' && showFollowFilter && (
                <View style={styles.filterMenu}>
                    <TouchableOpacity
                        style={styles.filterMenuItem}
                        onPress={() => {
                            setFollowFilter('Following');
                            setShowFollowFilter(false);
                        }}
                    >
                        <Text style={styles.filterMenuText}>Following</Text>
                        {followFilter === 'Following' && (
                            <Ionicons name="checkmark" size={20} color="#ff0050" />
                        )}
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.filterMenuItem}
                        onPress={() => {
                            setFollowFilter('Blocked');
                            setShowFollowFilter(false);
                        }}
                    >
                        <Text style={styles.filterMenuText}>Blocked</Text>
                        {followFilter === 'Blocked' && (
                            <Ionicons name="checkmark" size={20} color="#ff0050" />
                        )}
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.filterMenuItem}
                        onPress={() => {
                            setFollowFilter('Keywords');
                            setShowFollowFilter(false);
                        }}
                    >
                        <Text style={styles.filterMenuText}>Keywords</Text>
                        {followFilter === 'Keywords' && (
                            <Ionicons name="checkmark" size={20} color="#ff0050" />
                        )}
                    </TouchableOpacity>
                </View>
            )}

            {activeTab === 'History' && (
                <View style={styles.cacheInfoContainer}>
                    <Text style={styles.cacheInfoText}>{cacheInfo}</Text>
                </View>
            )}

            {activeTab === 'Following' && followFilter === 'Keywords' ? (
                <BlockedKeywordsView />
            ) : (
                <FlatList
                    key={`${activeTab}-${GRID_COLUMNS}`}
                    data={data}
                    keyExtractor={(item, index) => `${item.board}-${item.no}-${index}`}
                    renderItem={renderItem}
                    numColumns={activeTab === 'Following' ? 1 : GRID_COLUMNS}
                    contentContainerStyle={styles.grid}
                    ListEmptyComponent={<Text style={styles.empty}>No items found</Text>}
                    onEndReached={activeTab === 'History' ? loadMore : undefined}
                    onEndReachedThreshold={0.5}
                    ListFooterComponent={
                        activeTab === 'History' && isLoadingMore ? (
                            <View style={styles.loadingFooter}>
                                <Text style={styles.loadingText}>Loading more...</Text>
                            </View>
                        ) : null
                    }
                />
            )}

            {activeTab === 'History' && (
                <View style={styles.footer}>
                    <TouchableOpacity style={styles.button} onPress={handleClearHistory}>
                        <Text style={styles.buttonText}>Clear History</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.button, styles.danger]} onPress={handleClearCache}>
                        <Text style={styles.buttonText}>Clear Cache</Text>
                    </TouchableOpacity>
                </View>
            )}
        </SafeAreaView>
    );
}

function ThumbnailItem({ item, onPress, thumbnailSize }: { item: ThreadPost; onPress: () => void; thumbnailSize: number }) {
    const [thumbnailUri, setThumbnailUri] = useState<string | null>(null);

    useEffect(() => {
        const loadThumbnail = async () => {
            if (item.tim && item.ext) {
                const thumbUrl = `https://i.4cdn.org/${item.board}/${item.tim}s.jpg`;
                const uri = await getMediaUri(thumbUrl);
                setThumbnailUri(uri);
            }
        };
        loadThumbnail();
    }, [item]);

    const decodeHtml = (html: string) => {
        if (!html) return '';
        return html
            .replace(/<br>/g, '\n')
            .replace(/<[^>]+>/g, '')
            .replace(/&gt;/g, '>')
            .replace(/&lt;/g, '<')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&#039;/g, "'");
    };

    const getOpSub = () => {
        if (item.resto === 0) {
            return decodeHtml(item.sub || '');
        }
        if (item.opThread && item.opThread.sub) {
            return decodeHtml(item.opThread.sub);
        }
        return '';
    };

    const opSub = getOpSub();

    return (
        <TouchableOpacity style={[styles.thumbnail, { width: thumbnailSize, height: thumbnailSize }]} onPress={onPress}>
            {thumbnailUri ? (
                <Image source={{ uri: thumbnailUri }} style={styles.thumbnailImage} />
            ) : (
                <View style={[styles.thumbnailImage, styles.thumbnailPlaceholder]}>
                    <Ionicons name="image-outline" size={20} color="#555" />
                </View>
            )}
            {(item.ext === '.webm' || item.ext === '.mp4') && (
                <View style={styles.videoIndicator}>
                    <Text style={styles.videoIcon}>▶</Text>
                </View>
            )}
            {opSub && (
                <View style={styles.thumbnailOverlay}>
                    <Text style={styles.thumbnailText} numberOfLines={1}>{opSub}</Text>
                </View>
            )}
        </TouchableOpacity>
    );
}

function FollowingItem({ item, isBlocked, onToggleAction, onPress }: { item: ThreadPost; isBlocked: boolean; onToggleAction: () => void; onPress: () => void }) {
    const [thumbnailUri, setThumbnailUri] = useState<string | null>(null);
    const [isActive, setIsActive] = useState(true); // true = Following or Blocked (active state in list)

    useEffect(() => {
        // Reset state when item changes or list type changes
        setIsActive(true);
    }, [item, isBlocked]);

    useEffect(() => {
        const loadThumbnail = async () => {
            if (item.tim && item.ext) {
                const thumbUrl = `https://i.4cdn.org/${item.board}/${item.tim}s.jpg`;
                const uri = await getMediaUri(thumbUrl);
                setThumbnailUri(uri);
            }
        };
        loadThumbnail();
    }, [item]);

    const decodeHtml = (html: string) => {
        if (!html) return '';
        return html
            .replace(/<br>/g, '\n')
            .replace(/<[^>]+>/g, '')
            .replace(/&gt;/g, '>')
            .replace(/&lt;/g, '<')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&#039;/g, "'");
    };

    const handlePressToggle = () => {
        onToggleAction();
        setIsActive(!isActive);
    };

    return (
        <TouchableOpacity style={styles.followingItem} onPress={onPress}>
            <View style={styles.followingAvatarContainer}>
                {thumbnailUri ? (
                    <Image source={{ uri: thumbnailUri }} style={styles.followingAvatar} />
                ) : (
                    <View style={[styles.followingAvatar, { backgroundColor: '#333', justifyContent: 'center', alignItems: 'center' }]}>
                        <Ionicons name="person" size={20} color="#555" />
                    </View>
                )}
            </View>
            <View style={styles.followingInfo}>
                <Text style={styles.followingName} numberOfLines={1}>
                    {decodeHtml(item.sub || item.name || 'Anonymous')}
                </Text>
                <Text style={styles.followingBoard}>/{item.board}/</Text>
            </View>
            <TouchableOpacity
                style={[styles.unfollowButton, !isActive && styles.followButton]}
                onPress={handlePressToggle}
            >
                <Text style={[styles.unfollowText, !isActive && styles.followText]}>
                    {isBlocked
                        ? (isActive ? 'Unblock' : 'Block')
                        : (isActive ? 'Following' : 'Follow')
                    }
                </Text>
            </TouchableOpacity>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 15,
        paddingHorizontal: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    headerTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    aboutButtonText: {
        color: '#aaa',
        fontSize: 12,
    },
    offlineBanner: {
        backgroundColor: '#b00',
        padding: 5,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
    offlineText: {
        color: '#fff',
        fontSize: 12,
        marginLeft: 5,
        fontWeight: 'bold',
    },
    tabs: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#333',
        alignItems: 'center',
    },
    tab: {
        flex: 1,
        padding: 15,
        alignItems: 'center',
    },
    activeTab: {
        borderBottomWidth: 2,
        borderBottomColor: '#ff0050',
    },
    tabText: {
        color: '#888',
        fontSize: 14,
    },
    activeTabText: {
        color: '#fff',
        fontWeight: 'bold',
    },
    historyTab: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    filterMenu: {
        backgroundColor: '#222',
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    filterSection: {
        borderBottomWidth: 1,
        borderBottomColor: '#444',
        paddingVertical: 8,
    },
    filterSectionTitle: {
        color: '#888',
        fontSize: 12,
        paddingHorizontal: 12,
        paddingVertical: 8,
        fontWeight: 'bold',
    },
    filterMenuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 12,
        paddingHorizontal: 16,
    },
    filterMenuText: {
        color: '#fff',
        fontSize: 14,
    },
    cacheInfoContainer: {
        backgroundColor: '#1a1a1a',
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    cacheInfoText: {
        color: '#aaa',
        fontSize: 13,
        textAlign: 'center',
    },
    grid: {
        padding: 10,
    },
    thumbnail: {
        margin: 5,
        position: 'relative',
    },
    thumbnailImage: {
        width: '100%',
        height: '100%',
        borderRadius: 8,
        backgroundColor: '#222',
    },
    thumbnailPlaceholder: {
        backgroundColor: '#333',
        justifyContent: 'center',
        alignItems: 'center',
    },
    videoIndicator: {
        position: 'absolute',
        top: 5,
        right: 5,
        backgroundColor: 'rgba(0,0,0,0.6)',
        borderRadius: 12,
        width: 24,
        height: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    videoIcon: {
        color: '#fff',
        fontSize: 10,
    },
    empty: {
        color: '#666',
        textAlign: 'center',
        marginTop: 50,
    },
    footer: {
        flexDirection: 'row',
        padding: 10,
        paddingBottom: 15,
        borderTopWidth: 1,
        borderTopColor: '#333',
        gap: 8,
    },
    button: {
        flex: 1,
        backgroundColor: '#333',
        paddingVertical: 12,
        paddingHorizontal: 8,
        borderRadius: 6,
        alignItems: 'center',
    },
    danger: {
        backgroundColor: '#500',
    },
    legalButton: {
        backgroundColor: '#1a5',
    },
    buttonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 12,
    },
    followingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#222',
    },
    followingAvatarContainer: {
        marginRight: 15,
    },
    followingAvatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#333',
    },
    followingInfo: {
        flex: 1,
    },
    followingName: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    followingBoard: {
        color: '#888',
        fontSize: 14,
    },
    unfollowButton: {
        backgroundColor: '#333',
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#444',
    },
    unfollowText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    followButton: {
        backgroundColor: '#ff0050',
        borderColor: '#ff0050',
    },
    followText: {
        color: '#fff',
    },
    thumbnailOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        padding: 6,
        paddingHorizontal: 8,
    },
    thumbnailText: {
        color: '#fff',
        fontSize: 11,
        lineHeight: 14,
    },
    loadingFooter: {
        padding: 20,
        alignItems: 'center',
    },
    loadingText: {
        color: '#888',
        fontSize: 14,
    },
});
