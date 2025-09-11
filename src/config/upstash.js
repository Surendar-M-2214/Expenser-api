import { Redis } from '@upstash/redis'
import "dotenv/config";
import { Ratelimit } from '@upstash/ratelimit'
const redis = Redis.fromEnv()

const ratelimit = new Ratelimit({
    redis: redis,
    limiter: Ratelimit.slidingWindow(4, '10s'),
    prefix: 'ratelimit:',
})

export default ratelimit;