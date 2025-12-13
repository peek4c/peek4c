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
import { createStackNavigator, CardStyleInterpolators } from '@react-navigation/stack';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
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

// 自定义暗色主题，确保背景为黑色
const CustomDarkTheme = {
    ...DarkTheme,
    colors: {
        ...DarkTheme.colors,
        background: '#000',
        card: '#000',
        primary: '#ff0050',
    },
};

export default function AppNavigator({ initialRoute }: Props) {
    return (
        <NavigationContainer theme={CustomDarkTheme}>
            <Stack.Navigator
                initialRouteName={initialRoute}
                screenOptions={{
                    headerShown: false,
                    cardStyle: { backgroundColor: '#000' },
                    // 使用从右侧滑入的过渡动画，更流畅
                    cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
                }}
            >
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
