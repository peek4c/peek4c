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

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar, BackHandler } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BoardSelectionView from '../components/BoardSelectionView';
import FeedView from '../components/FeedView';
import { getConfig } from '../database/db';
import { fetchJson } from '../services/proxy';
import { Board } from '../types';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

export default function HomeScreen() {
    const [activeTab, setActiveTab] = useState('ALL');
    const [selectedBoards, setSelectedBoards] = useState<string[]>([]);
    const [boardsData, setBoardsData] = useState<Map<string, Board>>(new Map());
    const [followEnabled, setFollowEnabled] = useState(false);
    const [workSafeEnabled, setWorkSafeEnabled] = useState(true);
    const navigation = useNavigation<any>();

    useEffect(() => {
        loadConfig();
        loadBoardsData();
    }, []);

    useEffect(() => {
        // Listen for config changes
        const interval = setInterval(async () => {
            const followSaved = await getConfig('follow_enabled');
            if (followSaved !== null) {
                const newFollowEnabled = followSaved === 'true';
                if (newFollowEnabled !== followEnabled) {
                    setFollowEnabled(newFollowEnabled);
                }
            }

            const workSafeSaved = await getConfig('worksafe_enabled');
            if (workSafeSaved !== null) {
                const newWorkSafeEnabled = workSafeSaved === 'true';
                if (newWorkSafeEnabled !== workSafeEnabled) {
                    setWorkSafeEnabled(newWorkSafeEnabled);
                }
            }
        }, 500);

        return () => clearInterval(interval);
    }, [followEnabled, workSafeEnabled]);

    // Handle Android back button/gesture - only when HomeScreen is focused
    useFocusEffect(
        React.useCallback(() => {
            const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
                if (activeTab !== 'ALL') {
                    // If not on ALL tab, switch to ALL tab first
                    setActiveTab('ALL');
                    return true; // Prevent default back behavior
                }
                // If on ALL tab, allow app to exit
                return false;
            });

            return () => backHandler.remove();
        }, [activeTab])
    );

    const loadConfig = async () => {
        const saved = await getConfig('selected_boards');
        if (saved) {
            const boards = JSON.parse(saved);
            setSelectedBoards(boards);
            // Keep ALL as default tab
            // if (boards.length > 0) {
            //     setActiveTab(boards[0]);
            // }
        }

        // Load Follow setting
        const followSaved = await getConfig('follow_enabled');
        if (followSaved !== null) {
            setFollowEnabled(followSaved === 'true');
        }

        // Load WorkSafe setting
        const workSafeSaved = await getConfig('worksafe_enabled');
        if (workSafeSaved !== null) {
            setWorkSafeEnabled(workSafeSaved === 'true');
        }
    };

    const loadBoardsData = async () => {
        try {
            const data = await fetchJson<{ boards: Board[] }>('/boards.json', 86400);
            const boardMap = new Map<string, Board>();
            data.boards.forEach(board => {
                boardMap.set(board.board, board);
            });
            setBoardsData(boardMap);
        } catch (e) {
            console.error('[HomeScreen] Error loading boards data:', e);
        }
    };

    const handleSelectionChange = (boards: string[]) => {
        setSelectedBoards(boards);
        // If active tab is no longer in selection, switch to ALL
        if (activeTab !== 'ALL' && !boards.includes(activeTab)) {
            setActiveTab('ALL');
        }
    };

    const isNSFW = (boardId: string): boolean => {
        const board = boardsData.get(boardId);
        return board ? board.ws_board === 0 : false;
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

            {/* Content Layer */}
            <View style={styles.content}>
                <View style={[styles.tabContent, activeTab === 'ALL' ? styles.visible : styles.hidden]}>
                    <BoardSelectionView onSelectionChange={handleSelectionChange} />
                </View>

                {followEnabled && (
                    <View style={[styles.tabContent, activeTab === 'FOLLOW' ? styles.visible : styles.hidden]}>
                        <FeedView
                            board="__FOLLOW__"
                            isActiveTab={activeTab === 'FOLLOW'}
                            workSafeEnabled={workSafeEnabled}
                        />
                    </View>
                )}

                {selectedBoards.map(board => (
                    <View key={board} style={[styles.tabContent, activeTab === board ? styles.visible : styles.hidden]}>
                        <FeedView
                            board={board}
                            isActiveTab={activeTab === board}
                        />
                    </View>
                ))}
            </View>

            {/* Top Bar Overlay */}
            <SafeAreaView style={styles.topBar} edges={['top']}>
                <View style={styles.topBarContent}>
                    <View style={styles.tabsContainer}>
                        <View style={styles.tabs}>
                            <TouchableOpacity
                                style={[styles.tab, activeTab === 'ALL' && styles.activeTab]}
                                onPress={() => setActiveTab('ALL')}
                            >
                                <Text style={[styles.tabText, activeTab === 'ALL' && styles.activeTabText]}>ALL</Text>
                            </TouchableOpacity>

                            {followEnabled && (
                                <TouchableOpacity
                                    style={[styles.tab, activeTab === 'FOLLOW' && styles.activeTab]}
                                    onPress={() => setActiveTab('FOLLOW')}
                                >
                                    <Text style={[styles.tabText, activeTab === 'FOLLOW' && styles.activeTabText]}>Follow</Text>
                                </TouchableOpacity>
                            )}

                            {selectedBoards.map(board => {
                                const boardIsNSFW = isNSFW(board);
                                const isActive = activeTab === board;
                                return (
                                    <TouchableOpacity
                                        key={board}
                                        style={[
                                            styles.tab,
                                            isActive && (boardIsNSFW ? styles.activeTabNSFW : styles.activeTab)
                                        ]}
                                        onPress={() => setActiveTab(board)}
                                    >
                                        <Text style={[
                                            styles.tabText,
                                            boardIsNSFW && styles.tabTextNSFW,
                                            isActive && styles.activeTabText
                                        ]}>
                                            /{board}/
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>

                    {/* Persistent Me Button */}
                    <TouchableOpacity style={styles.meButton} onPress={() => navigation.navigate('Me')}>
                        <Text style={styles.meButtonText}>Me</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    content: {
        flex: 1,
    },
    tabContent: {
        flex: 1,
    },
    visible: {
        display: 'flex',
    },
    hidden: {
        display: 'none',
    },
    topBar: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        backgroundColor: 'transparent',
    },
    topBarContent: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
    },
    tabsContainer: {
        flex: 1,
        alignItems: 'flex-start', // Align to left
        paddingRight: 40, // Leave space for Me button on the right
    },
    tabs: {
        flexDirection: 'row',
        justifyContent: 'flex-start', // Align to left
        paddingVertical: 10,
    },
    tab: {
        paddingHorizontal: 15,
        paddingVertical: 5,
    },
    activeTab: {
        borderBottomWidth: 2,
        borderBottomColor: '#fff',
    },
    activeTabNSFW: {
        borderBottomWidth: 2,
        borderBottomColor: '#ff6b9d',
    },
    tabText: {
        color: '#aaa',
        fontWeight: 'bold',
        fontSize: 16,
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: -1, height: 1 },
        textShadowRadius: 10
    },
    tabTextNSFW: {
        color: '#ff6b9d',
    },
    activeTabText: {
        color: '#fff',
    },
    meButton: {
        padding: 5,
        position: 'absolute',
        right: 15,
    },
    meButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
