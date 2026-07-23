import { RedisClient } from "bun";
import { startCache } from "./cache";
import { db } from "./db";

export const redis = new RedisClient(process.env.REDIS_URL);
export const cache = startCache({
  del: redis.del.bind(redis),
  get: redis.get.bind(redis),
  keys: redis.keys.bind(redis),
  set: (...p) => redis.set(...p, "EX", 1800),
});

export { db };
