import React, { useEffect, useState, useRef, useMemo } from 'react';
import { View, Text, Image, StyleSheet, Dimensions, TouchableOpacity, TouchableWithoutFeedback, Linking, Alert, Modal, ActivityIndicator } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { useVideoPlayer, VideoView } from 'expo-video';
import { ThreadPost } from '../types';
import { getMediaUri, getMediaUriWithPriority } from '../services/proxy';
import { toggleStar, isStarred, toggleFollow, isFollowing } from '../database/db';
import { useNavigation } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useMute } from '../context/MuteContext';
import { followEvents } from '../services/followEvents';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS } from 'react-native-reanimated';

const { width, height } = Dimensions.get('window');

interface Props {
    thread: ThreadPost;
    isActive: boolean;
    onPressAvatar: () => void;
    isActiveTab?: boolean;
    shouldLoad?: boolean;
    threadBoard?: string; // Optional context: The board of the thread
    opThread?: ThreadPost;
    context?: string;
}

export default function ThreadItem({ thread, isActive, onPressAvatar, isActiveTab = true, shouldLoad = true, threadBoard, opThread, context }: Props) {
    const [imageUri, setImageUri] = useState<string | null>(null);
    const [thumbnailUri, setThumbnailUri] = useState<string | null>(null);
    const [avatarUri, setAvatarUri] = useState<string | null>(null);
    const [starred, setStarred] = useState(false);
    const [following, setFollowing] = useState(false);
    const [isVideoLoading, setIsVideoLoading] = useState(true);
    const navigation = useNavigation<any>();
    const { isMuted, toggleMute } = useMute();

    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [bufferedPosition, setBufferedPosition] = useState(0);
    const progressInterval = useRef<NodeJS.Timeout | null>(null);
    const [menuVisible, setMenuVisible] = useState(false);
    const [isSpeedingUp, setIsSpeedingUp] = useState(false);
    const [isSeeking, setIsSeeking] = useState(false);

    if (!thread) {
        return null;
    }

    const isVideo = thread.ext === '.webm' || thread.ext === '.mp4';

    // Determine the target for follow/star actions (Thread OP or current item)
    const targetId = opThread?.no || thread.no;
    const targetBoard = threadBoard || opThread?.board || thread.board;

    // CRITICAL: Use useMemo to stabilize mediaSource and prevent player recreation
    const mediaSource = useMemo(() => {
        if (!isVideo || !thread.tim || !thread.ext || !shouldLoad) {
            return null;
        }
        return {
            uri: `https://i.4cdn.org/${thread.board}/${thread.tim}${thread.ext}`,
            useCaching: true
        };
    }, [isVideo, thread.board, thread.tim, thread.ext, shouldLoad]);

    const player = useVideoPlayer(mediaSource, player => {
        if (player) {
            player.loop = true;
            player.muted = isMuted;
            if (isActive && isActiveTab) {
                player.play();
            }
        }
    });

    // Helper functions for gestures to run on JS thread
    const handleLongPressStart = () => {
        if (player && isVideo) {
            setIsSpeedingUp(true);
            player.playbackRate = 2.0;
        }
    };

    const handleLongPressEnd = () => {
        if (player && isVideo) {
            setIsSpeedingUp(false);
            player.playbackRate = 1.0;
        }
    };

    const handleSeekStart = () => {
        setIsSeeking(true);
    };

    const handleSeekUpdate = (absoluteX: number) => {
        if (player && duration > 0) {
            const percentage = Math.max(0, Math.min(1, absoluteX / width));
            const seekTime = percentage * duration;
            setCurrentTime(seekTime);
        }
    };

    const handleSeekEnd = (absoluteX: number) => {
        if (player && duration > 0) {
            const percentage = Math.max(0, Math.min(1, absoluteX / width));
            const seekTime = percentage * duration;
            player.currentTime = seekTime;
            setIsSeeking(false);
        }
    };

    // Gesture: Long Press for 2x Speed
    const longPressGesture = Gesture.LongPress()
        .onStart(() => {
            runOnJS(handleLongPressStart)();
        })
        .onEnd(() => {
            runOnJS(handleLongPressEnd)();
        });

    // Gesture: Pan for Seeking (on progress bar area)
    const seekGesture = Gesture.Pan()
        .onStart(() => {
            runOnJS(handleSeekStart)();
        })
        .onUpdate((e) => {
            runOnJS(handleSeekUpdate)(e.absoluteX);
        })
        .onEnd((e) => {
            runOnJS(handleSeekEnd)(e.absoluteX);
        });

    useEffect(() => {
        if (player) {
            const subscription = player.addListener('playingChange', (payload) => {
                const playing = payload.isPlaying;
                setIsPlaying(playing);
                if (playing) {
                    startProgressTracking();
                } else {
                    stopProgressTracking();
                }
            });

            const statusSubscription = player.addListener('statusChange', (status) => {
                if (status.status === 'readyToPlay' || status.status === 'idle') {
                    setIsVideoLoading(false);
                } else if (status.status === 'loading') {
                    setIsVideoLoading(true);
                }
            });

            return () => {
                subscription.remove();
                statusSubscription.remove();
                stopProgressTracking();
            };
        }
    }, [player]);

    const startProgressTracking = () => {
        if (progressInterval.current) clearInterval(progressInterval.current);
        progressInterval.current = setInterval(() => {
            if (player && !isSeeking) { // Don't update from player while seeking
                try {
                    setCurrentTime(player.currentTime);
                    setDuration(player.duration);
                    if (player.bufferedPosition !== undefined) {
                        setBufferedPosition(player.bufferedPosition);
                    }
                } catch (e) {
                    // Player might be released
                }
            }
        }, 250);
    };

    const stopProgressTracking = () => {
        if (progressInterval.current) {
            clearInterval(progressInterval.current);
            progressInterval.current = null;
        }
        if (player && !isSeeking) {
            try {
                setCurrentTime(player.currentTime);
            } catch (e) { }
        }
    };

    useEffect(() => {
        if (player) {
            player.muted = isMuted;
        }
    }, [isMuted, player]);

    useEffect(() => {
        if (player) {
            if (isActive && isActiveTab) {
                player.play();
            } else {
                player.pause();
            }
        }
    }, [isActive, isActiveTab, player]);

    useEffect(() => {
        const loadMedia = async () => {
            if (!shouldLoad) return;

            // For images, use proxy caching
            if (!isVideo && thread.tim && thread.ext && !imageUri) {
                const url = `https://i.4cdn.org/${thread.board}/${thread.tim}${thread.ext}`;
                const uri = await getMediaUriWithPriority(url, isActive, context);
                setImageUri(uri);
            }

            // Always load thumbnail for the item (media placeholder)
            if (thread.tim && !thumbnailUri) {
                const thumbUrl = `https://i.4cdn.org/${thread.board}/${thread.tim}s.jpg`;
                const thumbUri = await getMediaUriWithPriority(thumbUrl, isActive, context);
                setThumbnailUri(thumbUri);
            }

            // Load avatar thumbnail (use opThread if available, otherwise thread)
            const avatarItem = opThread || thread;
            if (avatarItem.tim && !avatarUri) {
                const avatarUrl = `https://i.4cdn.org/${avatarItem.board}/${avatarItem.tim}s.jpg`;
                const uri = await getMediaUriWithPriority(avatarUrl, isActive, context);
                setAvatarUri(uri);
            }

            const s = await isStarred(thread.no, thread.board);
            setStarred(s);
            const f = await isFollowing(targetId, targetBoard);
            setFollowing(f);
        };
        loadMedia();
    }, [thread, opThread, shouldLoad, isActive, targetId, targetBoard]);

    useEffect(() => {
        const unsubscribe = followEvents.onFollowChanged(({ threadNo, board, isFollowing: newFollowState }) => {
            if (threadNo === targetId && board === targetBoard) {
                setFollowing(newFollowState);
            }
        });
        return unsubscribe;
    }, [targetId, targetBoard]);

    const handleStar = async () => {
        await toggleStar(thread); // toggleStar only takes one argument
        setStarred(!starred);
    };

    const handleFollow = async () => {
        // Always operate on the opThread (the thread OP), not the individual post
        const threadToFollow = opThread || thread;
        await toggleFollow(threadToFollow);
        const newFollowState = !following;
        setFollowing(newFollowState);
        // Notify using the target (OP) ID and board
        followEvents.notifyFollowChanged(targetId, targetBoard, newFollowState);
    };

    const handleLink = () => {
        setMenuVisible(false);
        Alert.alert(
            'Open in Browser',
            'Do you want to open this thread in the browser?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Open',
                    onPress: () => {
                        const url = `https://boards.4chan.org/${thread.board}/thread/${thread.resto == 0 ? thread.no : thread.resto + '#pc' + thread.no}`;
                        Linking.openURL(url);
                    },
                },
            ]
        );
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

    const togglePlay = () => {
        if (player.playing) {
            player.pause();
        } else {
            player.play();
        }
    };

    const formatDuration = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const formatTime = (timestamp: number) => {
        const date = new Date(timestamp * 1000);
        return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
    };

    const handleSave = async () => {
        setMenuVisible(false);
        if (!thread.tim || !thread.ext) return;

        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission needed', 'Please grant permission to save media to gallery.');
            return;
        }

        try {
            let fileUri: string;
            const currentMediaUri = isVideo
                ? `https://i.4cdn.org/${thread.board}/${thread.tim}${thread.ext}`
                : imageUri;

            if (!currentMediaUri) {
                Alert.alert('Error', 'Media not loaded yet');
                return;
            }

            if (currentMediaUri.startsWith('file://')) {
                fileUri = currentMediaUri;
            } else {
                const tempUri = FileSystem.cacheDirectory + (thread.tim + thread.ext);
                await FileSystem.downloadAsync(currentMediaUri, tempUri);
                fileUri = tempUri;
            }

            const asset = await MediaLibrary.createAssetAsync(fileUri);
            const album = await MediaLibrary.getAlbumAsync('Peek4c');
            if (album == null) {
                await MediaLibrary.createAlbumAsync('Peek4c', asset, false);
            } else {
                await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
            }
            Alert.alert('Success', 'Saved to gallery');
        } catch (e) {
            console.error(e);
            Alert.alert('Error', 'Failed to save media');
        }
    };

    return (
        <View style={styles.container}>
            {isVideo ? (
                <GestureDetector gesture={longPressGesture}>
                    <TouchableWithoutFeedback onPress={togglePlay}>
                        <View style={styles.mediaContainer}>
                            {/* Thumbnail as background */}
                            {thumbnailUri && (
                                <Image
                                    source={{ uri: thumbnailUri }}
                                    style={[styles.media, styles.thumbnailBackground]}
                                    resizeMode="contain"
                                />
                            )}

                            {/* Video player */}
                            <VideoView
                                style={styles.media}
                                player={player}
                                contentFit="contain"
                                nativeControls={false}
                            />

                            {/* Loading indicator */}
                            {isVideoLoading && (
                                <View style={styles.loadingContainer}>
                                    <ActivityIndicator size="large" color="#fff" />
                                    <Text style={styles.loadingText}>Loading...</Text>
                                </View>
                            )}

                            {/* Speed Up Indicator */}
                            {isSpeedingUp && (
                                <View style={styles.speedIndicator}>
                                    <Ionicons name="play-forward" size={30} color="#fff" />
                                    <Text style={styles.speedText}>2x Speed</Text>
                                </View>
                            )}

                            {/* Play button when paused */}
                            {!isPlaying && !isVideoLoading && !isSeeking && (
                                <View style={styles.centerPlayButton}>
                                    <Ionicons name="play" size={50} color="rgba(255, 255, 255, 0.8)" />
                                </View>
                            )}

                            {/* Progress Bar and Time Display */}
                            <View style={styles.progressContainer}>
                                <View style={styles.timeRow}>
                                    <Text style={styles.progressTime}>
                                        {formatDuration(currentTime)} / {formatDuration(duration)}
                                    </Text>
                                </View>

                                <GestureDetector gesture={seekGesture}>
                                    <View style={styles.progressBarTouchArea}>
                                        <View style={styles.progressBarBackground}>
                                            {/* Buffer progress */}
                                            <View
                                                style={[
                                                    styles.progressBarBuffer,
                                                    { width: `${duration > 0 ? (bufferedPosition / duration) * 100 : 0}%` }
                                                ]}
                                            />
                                            {/* Playback progress */}
                                            <View
                                                style={[
                                                    styles.progressBarFill,
                                                    { width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }
                                                ]}
                                            />
                                            {/* Scrubber Knob */}
                                            <View
                                                style={[
                                                    styles.scrubberKnob,
                                                    { left: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }
                                                ]}
                                            />
                                        </View>
                                    </View>
                                </GestureDetector>
                            </View>
                        </View>
                    </TouchableWithoutFeedback>
                </GestureDetector>
            ) : (
                <TouchableWithoutFeedback>
                    <View style={styles.mediaContainer}>
                        {imageUri ? (
                            <Image
                                source={{ uri: imageUri }}
                                style={styles.media}
                                resizeMode="contain"
                            />
                        ) : (
                            <View style={[styles.media, styles.placeholder]}>
                                {thumbnailUri && (
                                    <Image source={{ uri: thumbnailUri }} style={styles.media} resizeMode="contain" />
                                )}
                                <ActivityIndicator size="large" color="#ff0050" style={{ position: 'absolute' }} />
                            </View>
                        )}
                    </View>
                </TouchableWithoutFeedback>
            )}

            <View style={styles.overlay}>
                <View style={styles.textContainer}>
                    <Text style={styles.title} numberOfLines={2}>{decodeHtml(opThread?.sub || thread.sub || thread.name || 'Anonymous')}</Text>
                    <Text style={styles.comment} numberOfLines={3}>
                        {thread.com ? decodeHtml(thread.com) : ''}
                    </Text>
                    <Text style={styles.timeText}>{formatTime(thread.time)}</Text>
                </View>
            </View>

            <View style={styles.rightMenu}>
                <View style={styles.avatarContainer}>
                    <TouchableOpacity onPress={onPressAvatar}>
                        {avatarUri ? (
                            <Image source={{ uri: avatarUri }} style={styles.avatar} />
                        ) : (
                            <View style={[styles.avatar, { backgroundColor: stringToColor(thread.no.toString()) }]}>
                                <Text style={styles.avatarText}>{thread.name ? thread.name[0] : 'A'}</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.plusIcon} onPress={handleFollow}>
                        <Ionicons name={following ? "checkmark" : "add"} size={12} color="#fff" />
                    </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.iconButton} onPress={handleStar}>
                    <MaterialCommunityIcons name={starred ? "clover" : "clover-outline"} size={35} color={starred ? "#00ff00" : "#fff"} />
                    <Text style={styles.iconText}>{starred ? 'Peeked' : 'Peek'}</Text>
                </TouchableOpacity>

                {/* More Menu Button */}
                <TouchableOpacity style={styles.iconButton} onPress={() => setMenuVisible(true)}>
                    <Ionicons name="ellipsis-horizontal-circle" size={40} color="#fff" />
                    <Text style={styles.iconText}>More</Text>
                </TouchableOpacity>

                {/* Volume Control (Video Only) */}
                {isVideo && (
                    <TouchableOpacity style={styles.iconButton} onPress={toggleMute}>
                        <Ionicons
                            name={isMuted ? "volume-mute" : "volume-high"}
                            size={25}
                            color="#fff"
                        />
                    </TouchableOpacity>
                )}
            </View>

            <Modal
                visible={menuVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setMenuVisible(false)}
            >
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setMenuVisible(false)}>
                    <View style={styles.modalContent}>
                        <TouchableOpacity style={styles.modalButton} onPress={handleSave}>
                            <Ionicons name="download-outline" size={24} color="#fff" style={styles.modalIcon} />
                            <Text style={styles.modalButtonText}>Save to Gallery</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.modalButton} onPress={handleLink}>
                            <Ionicons name="open-outline" size={24} color="#fff" style={styles.modalIcon} />
                            <Text style={styles.modalButtonText}>Open in Browser</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setMenuVisible(false)}>
                            <Text style={styles.modalButtonText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
        </View>
    );
}

function stringToColor(str: string) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const c = (hash & 0x00ffffff).toString(16).toUpperCase();
    return '#' + '00000'.substring(0, 6 - c.length) + c;
}

const styles = StyleSheet.create({
    container: {
        width: width,
        height: height,
        backgroundColor: '#000',
    },
    media: {
        width: '100%',
        height: '100%',
    },
    mediaContainer: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    placeholder: {
        backgroundColor: '#222',
        justifyContent: 'center',
        alignItems: 'center',
    },
    overlay: {
        position: 'absolute',
        bottom: 60,
        left: 10,
        right: 60,
    },
    textContainer: {
        marginBottom: 10,
    },
    title: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
        marginBottom: 5,
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: -1, height: 1 },
        textShadowRadius: 10,
    },
    comment: {
        color: '#eee',
        fontSize: 14,
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: -1, height: 1 },
        textShadowRadius: 10,
    },
    timeText: {
        color: 'rgba(255, 255, 255, 0.8)',
        fontSize: 12,
        marginTop: 5,
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: -1, height: 1 },
        textShadowRadius: 10,
    },
    rightMenu: {
        position: 'absolute',
        bottom: 60,
        right: 10,
        alignItems: 'center',
    },
    avatarContainer: {
        marginBottom: 20,
        alignItems: 'center',
    },
    iconButton: {
        marginBottom: 20,
        alignItems: 'center',
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#fff',
        overflow: 'hidden',
    },
    avatarText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 20,
    },
    plusIcon: {
        position: 'absolute',
        bottom: -10,
        backgroundColor: '#ff0050',
        width: 20,
        height: 20,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    iconText: {
        color: '#fff',
        fontSize: 12,
        marginTop: 2,
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: -1, height: 1 },
        textShadowRadius: 10,
    },
    centerPlayButton: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: [{ translateX: -25 }, { translateY: -25 }],
        zIndex: 10,
    },
    speedIndicator: {
        position: 'absolute',
        top: 90,
        alignSelf: 'center',
        backgroundColor: 'rgba(0,0,0,0.1)',
        padding: 10,
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        zIndex: 20,
    },
    speedText: {
        color: '#fff',
        fontWeight: 'bold',
        marginLeft: 5,
    },
    progressContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 10,
        paddingBottom: 10,
    },
    timeRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginBottom: 5,
    },
    progressBarTouchArea: {
        height: 30, // Larger touch area
        justifyContent: 'center',
    },
    progressBarBackground: {
        height: 4,
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        width: '100%',
    },
    progressBarBuffer: {
        position: 'absolute',
        height: '100%',
        backgroundColor: 'rgba(255, 255, 255, 0.5)',
    },
    progressBarFill: {
        position: 'absolute',
        height: '100%',
        backgroundColor: '#ff0050',
    },
    scrubberKnob: {
        position: 'absolute',
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#fff',
        top: -4,
        marginLeft: -6,
    },
    progressTime: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: -1, height: 1 },
        textShadowRadius: 10,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)', // 0.5 opacity as requested
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#1a1a1a',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
    },
    modalButton: {
        paddingVertical: 15,
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    modalIcon: {
        marginRight: 15,
    },
    cancelButton: {
        borderBottomWidth: 0,
        marginTop: 10,
        justifyContent: 'center',
    },
    modalButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    thumbnailBackground: {
        position: 'absolute',
        opacity: 0.5,
    },
    loadingContainer: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: [{ translateX: -50 }, { translateY: -50 }],
        alignItems: 'center',
        zIndex: 20,
    },
    loadingText: {
        color: '#fff',
        fontSize: 14,
        marginTop: 10,
        fontWeight: 'bold',
    },
});
