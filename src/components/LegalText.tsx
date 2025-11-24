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

import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface LegalTextProps {
    title: string;
    content: string;
}

export default function LegalText({ title, content }: LegalTextProps) {
    // Simple Markdown rendering - split text by lines and handle basic formatting
    const renderContent = () => {
        const lines = content.split('\n');
        return lines.map((line, index) => {
            // Headings
            if (line.startsWith('### ')) {
                return (
                    <Text key={index} style={styles.h3}>
                        {line.replace('### ', '')}
                    </Text>
                );
            }
            if (line.startsWith('## ')) {
                return (
                    <Text key={index} style={styles.h2}>
                        {line.replace('## ', '')}
                    </Text>
                );
            }
            if (line.startsWith('# ')) {
                return (
                    <Text key={index} style={styles.h1}>
                        {line.replace('# ', '')}
                    </Text>
                );
            }
            // Bold
            if (line.startsWith('**') && line.endsWith('**')) {
                return (
                    <Text key={index} style={styles.bold}>
                        {line.replace(/\*\*/g, '')}
                    </Text>
                );
            }
            // List items
            if (line.startsWith('- ')) {
                return (
                    <Text key={index} style={styles.listItem}>
                        • {line.replace('- ', '')}
                    </Text>
                );
            }
            // Divider
            if (line === '---') {
                return <View key={index} style={styles.divider} />;
            }
            // Empty line
            if (line.trim() === '') {
                return <View key={index} style={styles.spacer} />;
            }
            // Plain text
            return (
                <Text key={index} style={styles.text}>
                    {line}
                </Text>
            );
        });
    };

    return (
        <SafeAreaView style={styles.container} edges={['bottom']}>
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
                <Text style={styles.title}>{title}</Text>
                {renderContent()}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    scrollView: {
        flex: 1,
    },
    content: {
        padding: 20,
        paddingBottom: 40,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 20,
        textAlign: 'center',
    },
    h1: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#fff',
        marginTop: 20,
        marginBottom: 10,
    },
    h2: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
        marginTop: 16,
        marginBottom: 8,
    },
    h3: {
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
        marginTop: 12,
        marginBottom: 6,
    },
    text: {
        fontSize: 14,
        color: '#ccc',
        lineHeight: 20,
        marginBottom: 4,
    },
    bold: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 8,
    },
    listItem: {
        fontSize: 14,
        color: '#ccc',
        lineHeight: 20,
        marginBottom: 4,
        marginLeft: 10,
    },
    divider: {
        height: 1,
        backgroundColor: '#333',
        marginVertical: 16,
    },
    spacer: {
        height: 8,
    },
});
