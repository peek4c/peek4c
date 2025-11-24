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
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { setPassword } from '../services/auth';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SetPasswordScreen({ navigation }: any) {
    const [pass, setPass] = useState('');
    const [confirm, setConfirm] = useState('');
    const [error, setError] = useState('');

    const handleSetPassword = async () => {
        if (pass.length < 4) {
            setError('Password must be at least 4 characters');
            return;
        }
        if (pass !== confirm) {
            setError('Passwords do not match');
            return;
        }

        await setPassword(pass);
        navigation.replace('Home');
    };

    return (
        <SafeAreaView style={styles.container}>
            <Text style={styles.title}>Set New Password</Text>
            <TextInput
                style={styles.input}
                secureTextEntry
                value={pass}
                onChangeText={setPass}
                placeholder="New Password"
                placeholderTextColor="#666"
            />
            <TextInput
                style={styles.input}
                secureTextEntry
                value={confirm}
                onChangeText={setConfirm}
                placeholder="Confirm Password"
                placeholderTextColor="#666"
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity style={styles.button} onPress={handleSetPassword}>
                <Text style={styles.buttonText}>Set Password</Text>
            </TouchableOpacity>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        padding: 20,
        backgroundColor: '#000',
    },
    title: {
        fontSize: 24,
        color: '#fff',
        textAlign: 'center',
        marginBottom: 30,
    },
    input: {
        backgroundColor: '#333',
        color: '#fff',
        padding: 15,
        borderRadius: 8,
        fontSize: 16,
        marginBottom: 15,
    },
    button: {
        backgroundColor: '#ff0050',
        padding: 15,
        borderRadius: 8,
        alignItems: 'center',
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    error: {
        color: 'red',
        marginBottom: 15,
        textAlign: 'center',
    },
});
