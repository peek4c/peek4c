import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { fetchJson } from '../services/proxy';
import { Board } from '../types';
import { getConfig, setConfig, saveBoards } from '../database/db';
import { Ionicons } from '@expo/vector-icons';

interface Props {
    onSelectionChange: (boards: string[]) => void;
}

export default function BoardSelectionView({ onSelectionChange }: Props) {
    const [boards, setBoards] = useState<Board[]>([]);
    const [selected, setSelected] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [workSafeEnabled, setWorkSafeEnabled] = useState(true);
    const [followEnabled, setFollowEnabled] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            // Load saved selection
            const saved = await getConfig('selected_boards');
            if (saved) {
                setSelected(JSON.parse(saved));
            } else {
                // Default selection
                const defaults: string[] = [];
                setSelected(defaults);
                await setConfig('selected_boards', JSON.stringify(defaults));
                onSelectionChange(defaults);
            }

            // Load WorkSafe setting
            const workSafeSaved = await getConfig('worksafe_enabled');
            if (workSafeSaved !== null) {
                setWorkSafeEnabled(workSafeSaved === 'true');
            } else {
                await setConfig('worksafe_enabled', 'true');
            }

            // Load Follow setting
            const followSaved = await getConfig('follow_enabled');
            if (followSaved !== null) {
                setFollowEnabled(followSaved === 'true');
            } else {
                await setConfig('follow_enabled', 'false');
            }

            // Load boards
            const data = await fetchJson<{ boards: Board[] }>('/boards.json', 86400); // 1 day cache
            setBoards(data.boards);

            // Save boards to database
            await saveBoards(data.boards);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const toggleWorkSafe = async () => {
        const newValue = !workSafeEnabled;
        setWorkSafeEnabled(newValue);
        await setConfig('worksafe_enabled', newValue.toString());

        // Immediately filter out NSFW boards from selection when enabling WorkSafe
        if (newValue) {
            const filteredSelected = selected.filter(boardId => {
                const board = boards.find(b => b.board === boardId);
                return board && board.ws_board === 1;
            });

            setSelected(filteredSelected);
            await setConfig('selected_boards', JSON.stringify(filteredSelected));
            onSelectionChange(filteredSelected);
        }
    };

    const toggleFollow = async () => {
        const newValue = !followEnabled;
        setFollowEnabled(newValue);
        await setConfig('follow_enabled', newValue.toString());
    };

    const toggleBoard = async (boardId: string) => {
        let newSelected = [...selected];

        if (newSelected.includes(boardId)) {
            // Deselect: allow deselecting even if it's the last one (allow 0 boards)
            newSelected = newSelected.filter(b => b !== boardId);
        } else {
            // Select: if less than 3, add to the end
            if (newSelected.length < 3) {
                newSelected.push(boardId);
            } else {
                // If already 3 boards, replace the first one (FIFO - First In First Out)
                newSelected.shift(); // Remove the first (oldest) board
                newSelected.push(boardId); // Add the new board to the end
            }
        }

        setSelected(newSelected);
        await setConfig('selected_boards', JSON.stringify(newSelected));
        onSelectionChange(newSelected);
    };

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#ff0050" />
            </View>
        );
    }

    // Filter boards based on WorkSafe setting
    const displayBoards = workSafeEnabled
        ? boards.filter(b => b.ws_board === 1)
        : boards;

    return (
        <View style={styles.container}>
            <Text style={styles.header}>Select Boards (Max 3)</Text>

            {/* Checkboxes Row */}
            <View style={styles.checkboxRow}>
                <TouchableOpacity style={styles.checkboxContainer} onPress={toggleWorkSafe}>
                    <Ionicons
                        name={workSafeEnabled ? "checkbox" : "square-outline"}
                        size={24}
                        color="#ff0050"
                    />
                    <Text style={styles.checkboxLabel}>WorkSafe</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.checkboxContainer} onPress={toggleFollow}>
                    <Ionicons
                        name={followEnabled ? "checkbox" : "square-outline"}
                        size={24}
                        color="#ff0050"
                    />
                    <Text style={styles.checkboxLabel}>Follow</Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={displayBoards}
                keyExtractor={(item) => item.board}
                numColumns={3}
                renderItem={({ item }) => {
                    const isSelected = selected.includes(item.board);
                    const isNSFW = item.ws_board === 0; // ws_board: 0 = NSFW, 1 = Work Safe
                    return (
                        <TouchableOpacity
                            style={[
                                styles.item,
                                isNSFW && styles.itemNSFW,
                                isSelected && (isNSFW ? styles.itemSelectedNSFW : styles.itemSelected)
                            ]}
                            onPress={() => toggleBoard(item.board)}
                        >
                            <Text style={[styles.itemText, isSelected && styles.itemTextSelected]}>
                                /{item.board}/
                            </Text>
                            <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
                        </TouchableOpacity>
                    );
                }}
                contentContainerStyle={styles.list}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
        paddingTop: 100, // Space for top bar
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#000',
    },
    header: {
        color: '#fff',
        fontSize: 18,
        textAlign: 'center',
    },
    checkboxRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 8,
    },
    checkboxContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 15,
    },
    checkboxLabel: {
        color: '#fff',
        fontSize: 16,
        marginLeft: 10,
    },
    list: {
        paddingBottom: 100,
    },
    item: {
        flex: 1,
        margin: 5,
        padding: 15,
        backgroundColor: '#222',
        borderRadius: 8,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#333',
    },
    itemNSFW: {
        backgroundColor: '#2a1a1a',
        borderColor: '#4a2020',
    },
    itemSelected: {
        backgroundColor: '#ff0050',
        borderColor: '#ff0050',
    },
    itemSelectedNSFW: {
        backgroundColor: '#cc0040',
        borderColor: '#cc0040',
    },
    itemText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
    itemTextSelected: {
        color: '#fff',
    },
    itemTitle: {
        color: '#888',
        fontSize: 10,
        marginTop: 4,
    },
});
