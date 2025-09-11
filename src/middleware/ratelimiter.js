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
                console.log(error)
                next(error)
                return res.status(500).json({ message: "Internal server error" })
               
            }
  
}
