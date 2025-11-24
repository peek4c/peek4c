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

import * as SecureStore from 'expo-secure-store';
import { resetAllData } from '../database/db';

const PASSWORD_KEY = 'app_password';

export const hasPassword = async (): Promise<boolean> => {
    const password = await SecureStore.getItemAsync(PASSWORD_KEY);
    return !!password;
};

export const checkPassword = async (input: string): Promise<boolean> => {
    const storedPassword = await SecureStore.getItemAsync(PASSWORD_KEY);
    return storedPassword === input;
};

export const setPassword = async (password: string) => {
    await SecureStore.setItemAsync(PASSWORD_KEY, password);
};

export const resetApp = async () => {
    try {
        console.log('[Auth] Resetting app...');
        await SecureStore.deleteItemAsync(PASSWORD_KEY);
        console.log('[Auth] Password deleted');

        await resetAllData();
        console.log('[Auth] Database reset');

        // Clear file caches
        const { clearImageCache } = await import('./proxy');
        await clearImageCache();
        console.log('[Auth] Image cache cleared');

        try {
            const { clearVideoCacheAsync } = await import('expo-video');
            await clearVideoCacheAsync();
            console.log('[Auth] Video cache cleared');
        } catch (e) {
            console.error('[Auth] Error clearing video cache:', e);
        }
    } catch (e) {
        console.error('[Auth] Error resetting app:', e);
        throw e; // Re-throw to let caller handle it
    }
};
