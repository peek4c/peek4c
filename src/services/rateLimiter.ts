/**
 * API Rate Limiter
 * Ensure 4chan API request rate does not exceed one per second
 * Optimization: Consider the request execution time itself
 */

class ApiRateLimiter {
    private lastRequestTime = 0;
    private readonly minInterval = 1000; // 1 second

    async throttle<T>(fn: () => Promise<T>): Promise<T> {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;

        if (timeSinceLastRequest < this.minInterval) {
            const waitTime = this.minInterval - timeSinceLastRequest;
            console.log(`[ApiRateLimiter] Waiting ${waitTime}ms`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }

        const requestStartTime = Date.now();

        try {
            const result = await fn();
            this.lastRequestTime = Date.now();
            const requestDuration = this.lastRequestTime - requestStartTime;
            console.log(`[ApiRateLimiter] Request completed in ${requestDuration}ms`);
            return result;
        } catch (error) {
            this.lastRequestTime = Date.now();
            throw error;
        }
    }
}

export const rateLimiter = new ApiRateLimiter();
