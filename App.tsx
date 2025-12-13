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

import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { initDB, hasAcceptedTerms } from './src/database/db';
import { hasPassword } from './src/services/auth';
import AppNavigator from './src/navigation/AppNavigator';
import { StatusBar } from 'expo-status-bar';
import { MuteProvider } from './src/context/MuteContext';
import { BlurView } from 'expo-blur';
import { useAppState } from './src/hooks/useAppState';
import * as ScreenOrientation from 'expo-screen-orientation';

export default function App() {
  const [ready, setReady] = useState(false);
  const [initialRoute, setInitialRoute] = useState('Login');
  const isBackground = useAppState();

  useEffect(() => {
    const prepare = async () => {
      try {
        console.log('[App] Starting initialization...');
        
        // Enable screen rotation for all screens
        await ScreenOrientation.unlockAsync();
        
        await initDB();
        console.log('[App] Database initialized');

        // Check if user has accepted terms
        const acceptedTerms = await hasAcceptedTerms();
        console.log('[App] Has accepted terms:', acceptedTerms);

        if (!acceptedTerms) {
          // First time user - show disclaimer
          setInitialRoute('Disclaimer');
          console.log('[App] Initial route set to: Disclaimer');
        } else {
          // Check if password is set
          const hasPass = await hasPassword();
          console.log('[App] Has password:', hasPass);
          setInitialRoute(hasPass ? 'Login' : 'SetPassword');
          console.log('[App] Initial route set to:', hasPass ? 'Login' : 'SetPassword');
        }
      } catch (e) {
        console.error('[App] Initialization error:', e);
        // Still set ready to true to show error screen
      } finally {
        setReady(true);
        console.log('[App] App ready');
      }
    };
    prepare();
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
        <ActivityIndicator size="large" color="#ff0050" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <MuteProvider>
        <StatusBar style="light" />
        <AppNavigator initialRoute={initialRoute} />
        {isBackground && (
          <BlurView
            intensity={90}
            tint="dark"
            experimentalBlurMethod="dimezisBlurView"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 9999,
            }}
          />
        )}
      </MuteProvider>
    </GestureHandlerRootView>
  );
}
