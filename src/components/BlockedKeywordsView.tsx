import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getBlockedKeywords, addBlockedKeyword, removeBlockedKeyword, clearAllBlockedKeywords, resetToDefaultBlockedKeywords } from '../database/db';

export default function BlockedKeywordsView() {
    const [keywords, setKeywords] = useState<string[]>([]);
    const [inputValue, setInputValue] = useState('');

    useEffect(() => {
        loadKeywords();
    }, []);

    const loadKeywords = async () => {
        try {
            const kw = await getBlockedKeywords();
            kw.sort((a, b) => a.localeCompare(b));
            setKeywords(kw);
        } catch (e) {
            console.error('[BlockedKeywordsView] Error loading keywords:', e);
        }
    };

    const handleAddKeyword = async () => {
        const trimmed = inputValue.trim();
        if (!trimmed) {
            Alert.alert('Error', 'Keyword cannot be empty');
            return;
        }

        if (keywords.includes(trimmed.toLowerCase())) {
            Alert.alert('Error', 'Keyword already exists');
            return;
        }

        try {
            await addBlockedKeyword(trimmed);
            setInputValue('');
            await loadKeywords();
        } catch (e) {
            console.error('[BlockedKeywordsView] Error adding keyword:', e);
            Alert.alert('Error', 'Failed to add keyword');
        }
    };

    const handleRemoveKeyword = async (keyword: string) => {
        try {
            await removeBlockedKeyword(keyword);
            await loadKeywords();
        } catch (e) {
            console.error('[BlockedKeywordsView] Error removing keyword:', e);
            Alert.alert('Error', 'Failed to remove keyword');
        }
    };

    const handleClearAll = () => {
        Alert.alert(
            'Clear All Keywords',
            'Are you sure you want to remove all blocked keywords?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Clear',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await clearAllBlockedKeywords();
                            await loadKeywords();
                        } catch (e) {
                            console.error('[BlockedKeywordsView] Error clearing keywords:', e);
                            Alert.alert('Error', 'Failed to clear keywords');
                        }
                    }
                }
            ]
        );
    };

    const handleResetToDefault = () => {
        Alert.alert(
            'Reset to Default',
            'This will replace all current keywords with the default list. Continue?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Reset',
                    onPress: async () => {
                        try {
                            await resetToDefaultBlockedKeywords();
                            await loadKeywords();
                            Alert.alert('Success', 'Keywords reset to default list');
                        } catch (e) {
                            console.error('[BlockedKeywordsView] Error resetting keywords:', e);
                            Alert.alert('Error', 'Failed to reset keywords');
                        }
                    }
                }
            ]
        );
    };

    const renderKeywordTag = ({ item }: { item: string }) => (
        <View style={styles.tag}>
            <Text style={styles.tagText}>{item}</Text>
            <TouchableOpacity onPress={() => handleRemoveKeyword(item)} style={styles.tagRemove}>
                <Ionicons name="close" size={16} color="#fff" />
            </TouchableOpacity>
        </View>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Blocked Keywords</Text>
                <Text style={styles.headerSubtitle}>
                    Posts containing these keywords will be filtered out
                </Text>
            </View>

            <View style={styles.inputContainer}>
                <TextInput
                    style={styles.input}
                    placeholder="Enter keyword..."
                    placeholderTextColor="#666"
                    value={inputValue}
                    onChangeText={setInputValue}
                    onSubmitEditing={handleAddKeyword}
                    returnKeyType="done"
                    autoCapitalize="none"
                    autoCorrect={false}
                />
                <TouchableOpacity style={styles.addButton} onPress={handleAddKeyword}>
                    <Ionicons name="add" size={24} color="#fff" />
                </TouchableOpacity>
            </View>

            <View style={styles.actionButtons}>
                <TouchableOpacity style={styles.actionButton} onPress={handleResetToDefault}>
                    <Ionicons name="refresh" size={18} color="#fff" />
                    <Text style={styles.actionButtonText}>Reset to Default</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionButton, styles.clearButton]} onPress={handleClearAll}>
                    <Ionicons name="trash-outline" size={18} color="#fff" />
                    <Text style={styles.actionButtonText}>Clear All</Text>
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.tagsContainer}>
                <View style={styles.tagsWrapper}>
                    {keywords.length === 0 ? (
                        <Text style={styles.emptyText}>No blocked keywords yet</Text>
                    ) : (
                        keywords.map((item, index) => (
                            <View key={`${item}-${index}`} style={styles.tag}>
                                <Text style={styles.tagText}>{item}</Text>
                                <TouchableOpacity onPress={() => handleRemoveKeyword(item)} style={styles.tagRemove}>
                                    <Ionicons name="close" size={16} color="#fff" />
                                </TouchableOpacity>
                            </View>
                        ))
                    )}
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
        padding: 15,
    },
    header: {
        marginBottom: 20,
    },
    headerTitle: {
        color: '#fff',
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 5,
    },
    headerSubtitle: {
        color: '#888',
        fontSize: 14,
    },
    inputContainer: {
        flexDirection: 'row',
        marginBottom: 15,
        gap: 10,
    },
    input: {
        flex: 1,
        backgroundColor: '#222',
        color: '#fff',
        paddingHorizontal: 15,
        paddingVertical: 12,
        borderRadius: 8,
        fontSize: 16,
        borderWidth: 1,
        borderColor: '#333',
    },
    addButton: {
        backgroundColor: '#ff0050',
        width: 48,
        height: 48,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    actionButtons: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 20,
    },
    actionButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#444',
        paddingVertical: 12,
        paddingHorizontal: 15,
        borderRadius: 8,
        gap: 8,
    },
    clearButton: {
        backgroundColor: '#d32f2f',
    },
    actionButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    tagsContainer: {
        paddingBottom: 20,
    },
    tagsWrapper: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    tag: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#333',
        borderRadius: 20,
        paddingVertical: 8,
        paddingLeft: 15,
        paddingRight: 8,
        margin: 4,
        borderWidth: 1,
        borderColor: '#444',
    },
    tagText: {
        color: '#fff',
        fontSize: 14,
        marginRight: 8,
    },
    tagRemove: {
        backgroundColor: '#ff0050',
        borderRadius: 12,
        width: 24,
        height: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyText: {
        color: '#666',
        textAlign: 'center',
        marginTop: 50,
        fontSize: 16,
    },
});
