import { createClient } from "redis";

const redisClient = createClient({
    socket: {
        host: process.env.REDIS_HOST || "redis-cache",
        port: parseInt(process.env.REDIS_PORT) || 6379,
    },
    ...(process.env.REDIS_USERNAME && { username: process.env.REDIS_USERNAME }),
    ...(process.env.REDIS_PASSWORD && { password: process.env.REDIS_PASSWORD }),
});

redisClient.on("error", (err) => console.error("Redis error:", err));
await redisClient.connect();

export default redisClient;
