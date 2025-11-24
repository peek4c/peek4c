import React, { useEffect, useState, useRef } from 'react';
import { View, Text, FlatList, Image, StyleSheet, Dimensions, TouchableOpacity, Modal, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchJson, getMediaUri, clearDownloadQueue } from '../services/proxy';
import { ThreadPost } from '../types';
import { Ionicons } from '@expo/vector-icons';
import ThreadItem from '../components/ThreadItem';
import { toggleFollow, isFollowing, getViewedPosts, saveThreads, addToHistory, toggleBlock, isBlocked, updateThreadLastFetched } from '../database/db';
import { followEvents } from '../services/followEvents';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

const { width, height } = Dimensions.get('window');
const COLUMN_COUNT = 3;
const ITEM_SIZE = width / COLUMN_COUNT;

interface Props {
    route: {
        params: {
            thread: ThreadPost;
        };
    };
    navigation: any;
}

export default function ThreadDetailScreen({ route, navigation }: Props) {
    const { thread } = route.params;
    const [posts, setPosts] = useState<ThreadPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [fullScreenIndex, setFullScreenIndex] = useState<number | null>(null);
    const [isFollowingThread, setIsFollowingThread] = useState(false);
    const [isBlockedThread, setIsBlockedThread] = useState(false);
    const [headerImageUri, setHeaderImageUri] = useState<string | null>(null);
    const [viewedPosts, setViewedPosts] = useState<Set<number>>(new Set());

    // Unique context for this thread's downloads
    const downloadContext = `thread_${thread.no}`;

    useEffect(() => {
        loadPosts();
        checkFollowStatus();
        checkBlockStatus();
        loadHeaderImage();

        // Clear download queue when leaving this screen
        return () => {
            clearDownloadQueue(downloadContext);
        };
    }, [thread]);

    useEffect(() => {
        const unsubscribe = followEvents.onFollowChanged(({ threadNo, board, isFollowing }) => {
            if (threadNo === thread.no && board === thread.board) {
                setIsFollowingThread(isFollowing);
            }
        });
        return unsubscribe;
    }, [thread]);

    // Refresh viewed posts when screen gains focus
    useFocusEffect(
        React.useCallback(() => {
            const refreshViewedPosts = async () => {
                const viewed = await getViewedPosts(thread.board, thread.no);
                setViewedPosts(viewed);
            };
            refreshViewedPosts();
        }, [thread.board, thread.no])
    );

    const loadPosts = async () => {
        try {
            const response = await fetchJson<{ posts: ThreadPost[] }>(`/${thread.board}/thread/${thread.no}.json`);
            if (response && response.posts) {
                // Filter out items with empty tim and ext
                let posts = response.posts.filter(post => post.tim && post.ext);
                posts.forEach(post => {
                    post.board = thread.board;
                });
                //save or update
                await saveThreads(posts);
                await updateThreadLastFetched(thread.no, thread.board);
                setPosts(posts);
            }
            const viewed = await getViewedPosts(thread.board, thread.no);
            setViewedPosts(viewed);
        } catch (error) {
            console.error('Failed to load posts:', error);
        } finally {
            setLoading(false);
        }
    };

    const checkFollowStatus = async () => {
        const following = await isFollowing(thread.no, thread.board);
        setIsFollowingThread(following);
    };

    const checkBlockStatus = async () => {
        const blocked = await isBlocked(thread.no, thread.board);
        setIsBlockedThread(blocked);
    };

    const handleFollow = async () => {
        const newStatus = await toggleFollow(thread);
        setIsFollowingThread(newStatus);
    };

    const handleBlock = async () => {
        const newStatus = await toggleBlock(thread);
        setIsBlockedThread(newStatus);
        if (newStatus) {
            setIsFollowingThread(false);
        }
    };

    const loadHeaderImage = async () => {
        if (thread.tim) {
            const uri = await getMediaUri(`https://i.4cdn.org/${thread.board}/${thread.tim}s.jpg`, downloadContext);
            setHeaderImageUri(uri);
        }
    };

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

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#ff0050" />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <View style={styles.headerContent}>
                    <View style={styles.avatarColumn}>
                        <TouchableOpacity onPress={handleFollow} onLongPress={handleBlock} delayLongPress={500}>
                            {headerImageUri ? (
                                <Image
                                    source={{ uri: headerImageUri }}
                                    style={[styles.headerImage, isFollowingThread && styles.avatarFollowing]}
                                />
                            ) : (
                                <View style={[styles.headerImage, styles.placeholder, isFollowingThread && styles.avatarFollowing]} />
                            )}
                            {isBlockedThread && (
                                <View style={styles.blockedOverlay}>
                                    <Ionicons name="ban" size={40} color="red" />
                                </View>
                            )}
                        </TouchableOpacity>
                    </View>
                    <View style={styles.headerText}>
                        <Text style={styles.headerTitle} numberOfLines={1}>
                            {decodeHtml(thread.sub || thread.name || 'Anonymous')}
                        </Text>
                        <Text style={styles.headerSubtitle}>/{thread.board}/ - {thread.no}</Text>
                        {thread.com ? (
                            <Text style={styles.headerDescription} numberOfLines={3}>
                                {decodeHtml(thread.com)}
                            </Text>
                        ) : null}
                    </View>
                </View>
            </View>

            <FlatList
                style={styles.list}
                data={posts}
                keyExtractor={(item) => item.no.toString()}
                numColumns={COLUMN_COUNT}
                initialNumToRender={15}
                windowSize={3}
                maxToRenderPerBatch={6}
                updateCellsBatchingPeriod={50}
                removeClippedSubviews={true}
                renderItem={({ item, index }) => (
                    <TouchableOpacity
                        style={styles.gridItem}
                        onPress={() => setFullScreenIndex(index)}
                    >
                        <GridItem item={item} isViewed={viewedPosts.has(item.no)} context={downloadContext} />
                    </TouchableOpacity>
                )}
            />

            {fullScreenIndex !== null && (
                <FullScreenViewer
                    posts={posts}
                    initialIndex={fullScreenIndex}
                    onClose={async () => {
                        setFullScreenIndex(null);
                        // Refresh viewed posts after closing full screen viewer
                        const viewed = await getViewedPosts(thread.board, thread.no);
                        setViewedPosts(viewed);
                    }}
                    threadId={thread.no}
                    threadBoard={thread.board}
                    opThread={thread}
                    context={downloadContext}
                />
            )}
        </SafeAreaView>
    );
}

function GridItem({ item, isViewed, context }: { item: ThreadPost; isViewed: boolean; context: string }) {
    const [uri, setUri] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            if (item.tim) {
                const u = await getMediaUri(`https://i.4cdn.org/${item.board}/${item.tim}s.jpg`, context);
                setUri(u);
            }
        };
        load();
    }, [item, context]);

    return (
        <View style={styles.imageContainer}>
            {uri ? (
                <Image
                    source={{ uri }}
                    style={[styles.gridImage, isViewed && { opacity: 0.5 }]}
                    resizeMode="cover"
                />
            ) : (
                <View style={[styles.gridImage, styles.placeholder]} />
            )}
            {(item.ext === '.webm' || item.ext === '.mp4') && (
                <View style={styles.videoIndicator}>
                    <Text style={styles.videoIcon}>▶</Text>
                </View>
            )}
            {isViewed && (
                <View style={styles.viewedIndicator}>
                    <Ionicons name="eye" size={12} color="white" />
                </View>
            )}
        </View>
    );
}

function FullScreenViewer({ posts, initialIndex, onClose, threadId, threadBoard, opThread, context }: { posts: ThreadPost[]; initialIndex: number; onClose: () => void; threadId: number; threadBoard: string; opThread: ThreadPost; context: string }) {
    const [activeIndex, setActiveIndex] = useState(initialIndex);
    const navigation = useNavigation<any>();

    const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
        if (viewableItems.length > 0) {
            const index = viewableItems[0].index;
            setActiveIndex(index);

            // Add to history - similar to FeedView
            const item = posts[index];
            if (item && item.tim && item.ext) {
                addToHistory(item);
            }
        }
    }).current;

    const handleNavigateToDetail = () => {
        onClose();
    };

    return (
        <Modal visible={true} transparent={false} onRequestClose={onClose}>
            <View style={styles.fullScreenContainer}>
                <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                    <Ionicons name="close" size={30} color="#fff" />
                </TouchableOpacity>
                <FlatList
                    data={posts}
                    keyExtractor={(item) => item.no.toString()}
                    horizontal={false}
                    pagingEnabled
                    initialScrollIndex={initialIndex}
                    getItemLayout={(data, index) => ({
                        length: height,
                        offset: height * index,
                        index,
                    })}
                    onViewableItemsChanged={onViewableItemsChanged}
                    initialNumToRender={3}
                    maxToRenderPerBatch={3}
                    windowSize={5}
                    renderItem={({ item, index }) => (
                        <View style={{ width, height }}>
                            <ThreadItem
                                thread={item}
                                isActive={index === activeIndex}
                                shouldLoad={Math.abs(index - activeIndex) <= 1}
                                onPressAvatar={handleNavigateToDetail}
                                threadBoard={threadBoard}
                                opThread={opThread}
                                context={context}
                            />
                        </View>
                    )}
                />
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#000',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    headerContent: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    headerImage: {
        width: 100,
        height: 100,
        borderRadius: 50,
        marginBottom: 15,
    },
    avatarColumn: {
        alignItems: 'center',
        marginRight: 10,
    },
    headerText: {
        flex: 1,
        height: 100,
        justifyContent: 'flex-start',
        marginRight: 5,
    },
    headerTitle: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 18,
    },
    headerSubtitle: {
        color: '#888',
        fontSize: 16,
    },
    headerDescription: {
        color: '#ccc',
        fontSize: 16,
        marginTop: 2,
    },
    avatarFollowing: {
        borderWidth: 3,
        borderColor: '#ff0050',
    },
    blockedOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 15, // Match marginBottom of headerImage
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 50,
    },
    gridItem: {
        width: ITEM_SIZE,
        height: ITEM_SIZE,
        padding: 1,
    },
    imageContainer: {
        width: '100%',
        height: '100%',
        backgroundColor: '#222',
    },
    gridImage: {
        width: '100%',
        height: '100%',
    },
    placeholder: {
        backgroundColor: '#333',
    },
    videoIndicator: {
        position: 'absolute',
        top: 5,
        right: 5,
        backgroundColor: 'rgba(0,0,0,0.6)',
        width: 20,
        height: 20,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    videoIcon: {
        color: '#fff',
        fontSize: 10,
        fontWeight: 'bold',
    },
    viewedIndicator: {
        position: 'absolute',
        top: 5,
        left: 5,
        backgroundColor: 'rgba(0,0,0,0.6)',
        borderRadius: 10,
        padding: 2,
    },
    fullScreenContainer: {
        flex: 1,
        backgroundColor: '#000',
    },
    closeButton: {
        position: 'absolute',
        top: 40,
        left: 20,
        zIndex: 10,
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 20,
        padding: 5,
    },
    list: {
        flex: 1,
    },
});
