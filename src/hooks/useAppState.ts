import { useState, useEffect } from 'react';
import { AppState } from 'react-native';

export function useAppState() {
    const [isBackground, setIsBackground] = useState(false);

    useEffect(() => {
        // Handle regular state changes
        const changeSubscription = AppState.addEventListener('change', nextAppState => {
            if (nextAppState === 'background' || nextAppState === 'inactive') {
                setIsBackground(true);
            } else if (nextAppState === 'active') {
                setIsBackground(false);
            }
        });

        // Android 12+ multitasking view events
        const blurSubscription = AppState.addEventListener('blur', () => {
            setIsBackground(true);
        });
        const focusSubscription = AppState.addEventListener('focus', () => setIsBackground(false));

        return () => {
            changeSubscription.remove();
            blurSubscription.remove();
            focusSubscription.remove();
        };
    }, []);

    return isBackground;
}
