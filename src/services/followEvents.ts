// Simple event emitter for React Native (no Node.js dependencies)
type Listener = (data: { threadNo: number; board: string; isFollowing: boolean }) => void;

class FollowEventEmitter {
    private listeners: Listener[] = [];

    notifyFollowChanged(threadNo: number, board: string, isFollowing: boolean) {
        const data = { threadNo, board, isFollowing };
        this.listeners.forEach(listener => {
            try {
                listener(data);
            } catch (error) {
                console.error('[FollowEvents] Error in listener:', error);
            }
        });
    }

    onFollowChanged(callback: Listener): () => void {
        this.listeners.push(callback);
        return () => {
            const index = this.listeners.indexOf(callback);
            if (index > -1) {
                this.listeners.splice(index, 1);
            }
        };
    }
}

export const followEvents = new FollowEventEmitter();
