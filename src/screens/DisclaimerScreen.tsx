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
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { acceptTerms } from '../database/db';

export default function DisclaimerScreen({ navigation }: any) {
    const [agreed, setAgreed] = useState(false);

    const handleAccept = async () => {
        if (!agreed) {
            Alert.alert('Notice', 'Please read and check the agreement box');
            return;
        }

        await acceptTerms();
        navigation.replace('SetPassword');
    };

    const handleDecline = () => {
        Alert.alert(
            'Cannot Continue',
            'You must agree to the Terms of Service and Disclaimer to use this application.',
            [{ text: 'OK' }]
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>⚠️ Important Notice</Text>
                <Text style={styles.subtitle}>Please read carefully before using</Text>
            </View>

            <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
                <View style={styles.warningBox}>
                    <Text style={styles.warningTitle}>Content Warning</Text>
                    <Text style={styles.warningText}>
                        This is an open-source, non-profit third-party 4chan browser.
                        {'\n\n'}
                        4chan.org may contain adult content, violence, offensive or illegal material.
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>📋 Important Statements</Text>

                    <Text style={styles.point}>
                        <Text style={styles.pointNumber}>1. </Text>
                        <Text style={styles.pointBold}>Age Requirement:</Text>
                        {' '}You must be 18 years or older, or of legal age in your region.
                    </Text>

                    <Text style={styles.point}>
                        <Text style={styles.pointNumber}>2. </Text>
                        <Text style={styles.pointBold}>Content Disclaimer:</Text>
                        {' '}Developers do not create, host, or control any content accessed through this app.
                    </Text>

                    <Text style={styles.point}>
                        <Text style={styles.pointNumber}>3. </Text>
                        <Text style={styles.pointBold}>User Responsibility:</Text>
                        {' '}You assume all risks of using this app and must comply with local laws.
                    </Text>

                    <Text style={styles.point}>
                        <Text style={styles.pointNumber}>4. </Text>
                        <Text style={styles.pointBold}>No Warranty:</Text>
                        {' '}This software is provided "as is" without any warranties or technical support.
                    </Text>

                    <Text style={styles.point}>
                        <Text style={styles.pointNumber}>5. </Text>
                        <Text style={styles.pointBold}>Privacy Protection:</Text>
                        {' '}All data is stored locally on your device and not uploaded to any server.
                    </Text>

                    <Text style={styles.point}>
                        <Text style={styles.pointNumber}>6. </Text>
                        <Text style={styles.pointBold}>Third-Party Service:</Text>
                        {' '}This app uses 4chan.org's public API. Developers have no affiliation with 4chan.org.
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>⚖️ Legal Documents</Text>
                    <Text style={styles.legalText}>
                        By using this app, you acknowledge that you have read and agree to:
                        {'\n'}• Terms of Service
                        {'\n'}• Privacy Policy
                        {'\n'}• Disclaimer
                    </Text>
                </View>

                <View style={styles.confirmBox}>
                    <TouchableOpacity
                        style={styles.checkbox}
                        onPress={() => setAgreed(!agreed)}
                    >
                        <View style={[styles.checkboxInner, agreed && styles.checkboxChecked]}>
                            {agreed && <Text style={styles.checkmark}>✓</Text>}
                        </View>
                        <Text style={styles.checkboxLabel}>
                            I am 18+ years old, have read and agree to all the above terms, and understand and accept the risks of using this application.
                        </Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity
                    style={[styles.button, styles.declineButton]}
                    onPress={handleDecline}
                >
                    <Text style={styles.declineButtonText}>Decline</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.button, styles.acceptButton, !agreed && styles.buttonDisabled]}
                    onPress={handleAccept}
                >
                    <Text style={styles.acceptButtonText}>Agree & Continue</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    header: {
        padding: 20,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#ff0050',
        textAlign: 'center',
        marginBottom: 5,
    },
    subtitle: {
        fontSize: 14,
        color: '#888',
        textAlign: 'center',
    },
    scrollView: {
        flex: 1,
    },
    content: {
        padding: 20,
        paddingBottom: 20,
    },
    warningBox: {
        backgroundColor: '#ff0050',
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
    },
    warningTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 8,
    },
    warningText: {
        fontSize: 14,
        color: '#fff',
        lineHeight: 20,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 12,
    },
    point: {
        fontSize: 14,
        color: '#ccc',
        lineHeight: 22,
        marginBottom: 12,
    },
    pointNumber: {
        color: '#ff0050',
        fontWeight: 'bold',
    },
    pointBold: {
        color: '#fff',
        fontWeight: 'bold',
    },
    legalText: {
        fontSize: 14,
        color: '#ccc',
        lineHeight: 22,
    },
    confirmBox: {
        backgroundColor: '#1a1a1a',
        borderRadius: 12,
        padding: 16,
        marginTop: 8,
    },
    checkbox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    checkboxInner: {
        width: 24,
        height: 24,
        borderWidth: 2,
        borderColor: '#666',
        borderRadius: 6,
        marginRight: 12,
        marginTop: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkboxChecked: {
        backgroundColor: '#ff0050',
        borderColor: '#ff0050',
    },
    checkmark: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    checkboxLabel: {
        flex: 1,
        fontSize: 14,
        color: '#fff',
        lineHeight: 20,
    },
    footer: {
        flexDirection: 'row',
        padding: 20,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#333',
        gap: 12,
    },
    button: {
        flex: 1,
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
    },
    declineButton: {
        backgroundColor: '#333',
    },
    acceptButton: {
        backgroundColor: '#ff0050',
    },
    buttonDisabled: {
        backgroundColor: '#444',
        opacity: 0.5,
    },
    declineButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    acceptButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: 'bold',
    },
});
