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

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LegalText from '../components/LegalText';

// Simplified legal document content - in production, could be loaded from files
const TERMS_OF_SERVICE = `# Terms of Service

## 1. Acceptance of Terms
By using this application, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.

## 2. Service Description
This application is an open-source, non-profit third-party client for accessing and browsing public content from 4chan.org.

### 2.1 Service Content
- Retrieves content through 4chan.org's public API
- Provides a vertical scrolling browsing interface
- Stores browsing history and cache locally on your device

## 3. User Eligibility
To use this application, you must:
- Be at least 18 years old or of legal age in your jurisdiction
- Have full legal capacity
- Be legally permitted to use this application in your region

## 4. Content Warning
**IMPORTANT WARNING:** 4chan.org may contain:
- Adult content (pornography, nudity, etc.)
- Violent and graphic content
- Offensive, controversial, or disturbing language and images

## 5. User Responsibilities
- Comply with all applicable laws
- Take responsibility for all content accessed through this application
- Protect your device and application password

## 6. Disclaimers
This application is provided "as is" without any express or implied warranties.

## 7. Limitation of Liability
Developers are not liable for any direct, indirect, incidental, special, or consequential damages.

---
For the complete version, please visit the GitHub repository.`;

const PRIVACY_POLICY = `# Privacy Policy

## 1. Introduction
This application respects and protects user privacy.

IMPORTANT STATEMENT: This application is completely localized, with all data stored only on your device.

## 2. Information Collection
The application collects and stores locally on your device:

### 2.1 Application Password
- Storage location: Device local secure storage
- Purpose: Verify application access permissions

### 2.2 Browsing History
- Storage location: Device local SQLite database
- Purpose: Provide history feature

### 2.3 Media Cache
- Storage location: Device local file system
- Purpose: Provide offline browsing and fast loading

## 3. Information We Do Not Collect
- Personal identification information
- Device identifiers
- Location information
- Contact lists

## 4. Information Use
All data is used only on your device for:
- Password verification
- History display
- Favorites management
- Cache loading

## 5. Information Sharing
**We do not share your information with any third parties.**

## 6. Third-Party Services
This application uses 4chan.org's public API. Your interactions with 4chan.org are subject to their privacy policy.

## 7. Data Security
- Password encryption
- All data stored locally only
- No remote access features

---
For the complete version, please visit the GitHub repository.`;

const ABOUT_TEXT = `# About Peek4c

## Version Information
- Version: 1.0.0
- Build Date: 2025-11-25

## Project Introduction
Peek4c is an open-source, non-profit third-party 4chan browser application.

### Key Features
- Vertical scrolling browsing
- Local caching
- Favorites and history
- Local password protection

## Tech Stack
- React Native 0.81.5
- Expo SDK 54
- TypeScript
- SQLite

## Open Source License
This project is open-sourced under the GPLv3 License.

## Disclaimer
This application has no affiliation with 4chan.org or its operators.
Developers are not responsible for content accessed through this application.

## Contact
GitHub: Please visit the project repository to submit Issues

---
Copyright © 2025 Peek4c Contributors

GitHub Repository: 

https://github.com/peek4c/peek4c.git

This project is for educational and learning purposes only. Please use responsibly.`;

type LegalType = 'terms' | 'privacy' | 'about';

export default function LegalScreen({ route, navigation }: any) {
    const { type } = route.params as { type: LegalType };

    const [selectedType, setSelectedType] = useState<LegalType>(type || 'about');

    const getContent = () => {
        switch (selectedType) {
            case 'terms':
                return { title: 'Terms of Service', content: TERMS_OF_SERVICE };
            case 'privacy':
                return { title: 'Privacy Policy', content: PRIVACY_POLICY };
            case 'about':
                return { title: 'About', content: ABOUT_TEXT };
            default:
                return { title: 'About', content: ABOUT_TEXT };
        }
    };

    const { title, content } = getContent();

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Text style={styles.backButtonText}>← Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Legal Information</Text>
                <View style={styles.placeholder} />
            </View>

            <View style={styles.tabs}>
                <TouchableOpacity
                    style={[styles.tab, selectedType === 'about' && styles.tabActive]}
                    onPress={() => setSelectedType('about')}
                >
                    <Text style={[styles.tabText, selectedType === 'about' && styles.tabTextActive]}>
                        About
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.tab, selectedType === 'terms' && styles.tabActive]}
                    onPress={() => setSelectedType('terms')}
                >
                    <Text style={[styles.tabText, selectedType === 'terms' && styles.tabTextActive]}>
                        Terms
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.tab, selectedType === 'privacy' && styles.tabActive]}
                    onPress={() => setSelectedType('privacy')}
                >
                    <Text style={[styles.tabText, selectedType === 'privacy' && styles.tabTextActive]}>
                        Privacy
                    </Text>
                </TouchableOpacity>
            </View>

            <LegalText title={title} content={content} />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    backButton: {
        padding: 8,
    },
    backButtonText: {
        color: '#ff0050',
        fontSize: 16,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
    },
    placeholder: {
        width: 60,
    },
    tabs: {
        flexDirection: 'row',
        backgroundColor: '#1a1a1a',
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    tab: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    tabActive: {
        borderBottomColor: '#ff0050',
    },
    tabText: {
        fontSize: 14,
        color: '#888',
    },
    tabTextActive: {
        color: '#fff',
        fontWeight: 'bold',
    },
});
