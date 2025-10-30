import ratelimit from "../config/upstash.js";

export   const ratelimiter = async (req, res, next) => {
            try {
                const { success, limit, reset, remaining } = await ratelimit.limit(req.ip)
                if (!success) {
                    return res.status(429).json({ message: "Rate limit exceeded" })
                }
                res.setHeader("X-RateLimit-Limit", limit)
                res.setHeader("X-RateLimit-Remaining", remaining)
                res.setHeader("X-RateLimit-Reset", reset)         
                next()
                // console.log(res)
            } catch (error) {
                console.error(error)
                // Gracefully bypass rate limiting if the provider is unreachable
                // Avoid sending a response after calling next() to prevent ERR_HTTP_HEADERS_SENT
                res.setHeader("X-RateLimit-Bypass", "true")
                return next()
               
            }
  
}
