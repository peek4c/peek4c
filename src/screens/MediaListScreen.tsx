import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, FlatList, Dimensions, StyleSheet, PanResponder } from 'react-native';
import { ThreadPost } from '../types';
import ThreadItem from '../components/ThreadItem';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

const { height, width } = Dimensions.get('window');

interface Props {
    route: {
        params: {
            threads: ThreadPost[];
            initialIndex: number;
        };
    };
}



export default function MediaListScreen({ route }: Props) {
    const { threads, initialIndex } = route.params;
    const [data, setData] = useState<ThreadPost[]>([]);
    const [activeIndex, setActiveIndex] = useState(0);
    const navigation = useNavigation<any>();
    const flatListRef = useRef<FlatList>(null);

    useEffect(() => {
        setData(threads);
        setActiveIndex(initialIndex);

        // Scroll to initial index
        setTimeout(() => {
            flatListRef.current?.scrollToIndex({ index: initialIndex, animated: false });
        }, 100);
    }, []);

    const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
        if (viewableItems.length > 0) {
            const index = viewableItems[0].index;
            setActiveIndex(index);
        }
    }, []);

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

    return (
        <View style={styles.container}>
            <FlatList
                ref={flatListRef}
                data={data}
                keyExtractor={(item, index) => `${item.no}-${index}`}
                renderItem={({ item, index }) => (
                    <FeedItemWrapper
                        item={item}
                        isActive={index === activeIndex}
                        onNavigate={() => handleNavigateToDetail(item)}
                    />
                )}
                pagingEnabled
                showsVerticalScrollIndicator={false}
                snapToInterval={height}
                decelerationRate="fast"
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
                initialNumToRender={3}
                maxToRenderPerBatch={3}
                windowSize={5}
                getItemLayout={(data, index) => ({
                    length: height,
                    offset: height * index,
                    index,
                })}
            />
        </View>
    );
}

function FeedItemWrapper({ item, isActive, onNavigate }: { item: ThreadPost; isActive: boolean; onNavigate: () => void }) {
    const panResponder = useRef(
        PanResponder.create({
            onMoveShouldSetPanResponder: (_, gestureState) => {
                // Activate on swipe left (dx < -20)
                return gestureState.dx < -20 && Math.abs(gestureState.dy) < 20;
            },
            onPanResponderRelease: (_, gestureState) => {
                if (gestureState.dx < -50) {
                    onNavigate();
                }
            }
        })
    ).current;

    return (
        <View style={{ width, height }} {...panResponder.panHandlers}>
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
});
