import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import PagerView from 'react-native-pager-view';
import { ThreadPost } from '../types';
import ThreadItem from '../components/ThreadItem';
import { useNavigation } from '@react-navigation/native';
import * as ScreenOrientation from 'expo-screen-orientation';

interface Props {
    route?: {
        params: {
            threads: ThreadPost[];
            initialIndex: number;
        };
    };
}

export default function MediaListScreen({ route }: Props) {
    const { threads, initialIndex } = route?.params || { threads: [], initialIndex: 0 };
    const [data, setData] = useState<ThreadPost[]>([]);
    const [activeIndex, setActiveIndex] = useState(0);
    const navigation = useNavigation<any>();
    const pagerRef = useRef<PagerView>(null);
    const { height: screenHeight, width: screenWidth } = useWindowDimensions();

    useEffect(() => {
        setData(threads);
        setActiveIndex(initialIndex);

        // Set initial page
        setTimeout(() => {
            pagerRef.current?.setPage(initialIndex);
        }, 100);
    }, []);

    const handlePageSelected = (e: any) => {
        const newIndex = e.nativeEvent.position;
        setActiveIndex(newIndex);
    };

    const handleNavigateToDetail = (item: ThreadPost) => {
        if (!item) return;

        let targetThread = item;
        if (item.opThread) {
            targetThread = item.opThread;
        } else if (item.resto !== 0) {
            // It's a reply and we don't have opThread (context).
            // Construct a minimal thread object to allow navigation to the thread.
            // We use the resto ID as the thread ID.
            targetThread = {
                ...item,
                no: item.resto,
                // We don't have the OP's subject or comment, so they will be empty/default in the detail screen
                sub: undefined,
                com: undefined,
                tim: undefined, // No OP image known
            };
        }

        navigation.navigate('ThreadDetail', { thread: targetThread });
    };

    // Check if an item should be rendered (only render current + adjacent items)
    const shouldRenderItem = (index: number) => {
        return Math.abs(index - activeIndex) <= 1; // Only render current and ±1 items
    };

    return (
        <View style={styles.container}>
            <PagerView
                ref={pagerRef}
                style={styles.pager}
                initialPage={initialIndex}
                orientation="vertical"
                onPageSelected={handlePageSelected}
                overdrag={true}
            >
                {data.map((item, index) => (
                    <View key={`${item.no}-${index}`} style={styles.page}>
                        {shouldRenderItem(index) ? (
                            <FeedItemWrapper
                                item={item}
                                isActive={index === activeIndex}
                                onNavigate={() => handleNavigateToDetail(item)}
                                itemHeight={screenHeight}
                                itemWidth={screenWidth}
                            />
                        ) : (
                            <View style={{ width: screenWidth, height: screenHeight, backgroundColor: '#000' }} />
                        )}
                    </View>
                ))}
            </PagerView>
        </View>
    );
}

function FeedItemWrapper({ item, isActive, onNavigate, itemHeight, itemWidth }: { item: ThreadPost; isActive: boolean; onNavigate: () => void; itemHeight: number; itemWidth: number }) {
    return (
        <View style={{ width: itemWidth, height: itemHeight }}>
            <ThreadItem
                thread={item}
                isActive={isActive}
                onPressAvatar={onNavigate}
                opThread={item.opThread}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    pager: {
        flex: 1,
    },
    page: {
        flex: 1,
    },
});
