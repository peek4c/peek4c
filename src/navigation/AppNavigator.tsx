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
import { createStackNavigator } from '@react-navigation/stack';
import { NavigationContainer } from '@react-navigation/native';
import DisclaimerScreen from '../screens/DisclaimerScreen';
import LoginScreen from '../screens/LoginScreen';
import SetPasswordScreen from '../screens/SetPasswordScreen';
import HomeScreen from '../screens/HomeScreen';
import MeScreen from '../screens/MeScreen';
import ThreadDetailScreen from '../screens/ThreadDetailScreen';
import LegalScreen from '../screens/LegalScreen';
import MediaListScreen from '../screens/MediaListScreen';

const Stack = createStackNavigator();

interface Props {
    initialRoute: string;
}

export default function AppNavigator({ initialRoute }: Props) {
    return (
        <NavigationContainer>
            <Stack.Navigator initialRouteName={initialRoute} screenOptions={{ headerShown: false }}>
                <Stack.Screen name="Disclaimer" component={DisclaimerScreen} />
                <Stack.Screen name="Login" component={LoginScreen} />
                <Stack.Screen name="SetPassword" component={SetPasswordScreen} />
                <Stack.Screen name="Home" component={HomeScreen} />
                <Stack.Screen name="Me" component={MeScreen} />
                <Stack.Screen name="ThreadDetail" component={ThreadDetailScreen} />
                <Stack.Screen name="Legal" component={LegalScreen} />
                <Stack.Screen name="MediaList" component={MediaListScreen} />
            </Stack.Navigator>
        </NavigationContainer>
    );
}
