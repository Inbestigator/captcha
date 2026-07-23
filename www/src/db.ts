import { createClient } from "redis";
import { startCache } from "../../src/db/cache.ts";

const redis = await createClient({ url: process.env.REDIS_URL }).connect();

export const cache = startCache({
  del: redis.del.bind(redis),
  get: redis.get.bind(redis),
  keys: redis.keys.bind(redis),
  set: (...p) => redis.set(...p, { expiration: { type: "EX", value: 1800 } }),
});
