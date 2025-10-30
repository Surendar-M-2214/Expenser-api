// Lightweight in-memory rate limiter (token bucket) compatible with previous API

const capacity = 20; // max requests
const windowMs = 10 * 1000; // per 10s
const refillRatePerMs = capacity / windowMs; // tokens per ms

const bucketByKey = new Map();

function getBucket(key) {
    const now = Date.now();
    let bucket = bucketByKey.get(key);
    if (!bucket) {
        bucket = { tokens: capacity, lastRefillAt: now };
        bucketByKey.set(key, bucket);
        return bucket;
    }
    const elapsedMs = Math.max(0, now - bucket.lastRefillAt);
    if (elapsedMs > 0) {
        const refill = elapsedMs * refillRatePerMs;
        bucket.tokens = Math.min(capacity, bucket.tokens + refill);
        bucket.lastRefillAt = now;
    }
    return bucket;
}

const ratelimit = {
    async limit(key) {
        const bucket = getBucket(key);
        let success = false;
        if (bucket.tokens >= 1) {
            bucket.tokens -= 1;
            success = true;
        }
        const remaining = Math.max(0, Math.floor(bucket.tokens));
        const tokensToFull = capacity - bucket.tokens;
        const msToFull = tokensToFull <= 0 ? 0 : Math.ceil(tokensToFull / refillRatePerMs);
        const reset = Math.ceil((Date.now() + msToFull) / 1000); // epoch seconds until full
        return { success, limit: capacity, remaining, reset };
    }
}

export default ratelimit;