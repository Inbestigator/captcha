import { hash } from "node:crypto";
import { createCache, getters } from "@dressed/ws/cache";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { createClient } from "redis";
import { stagesTable } from "./schema";

export const resolveKey = (key: string, args: string[]) => `${key.toString()}:${hash("sha1", JSON.stringify(args))}`;

export const redis = await createClient({ url: process.env.REDIS_URL }).connect();
export const db = drizzle(process.env.DATABASE_URL as string);

export const cache = createCache(
  {
    ...getters,
    listStages: (guild: string) => db.select().from(stagesTable).where(eq(stagesTable.guild, guild)),
  },
  {
    desiredProps: { getGuild: ["name"] },
    logic: {
      async get(key) {
        const res = await redis.get(key);
        if (!res) return { state: "miss" };
        const data = JSON.parse(res);
        return { state: Date.now() < data.staleAt ? "hit" : "stale", ...data };
      },
      set(key, value) {
        redis.set(
          key,
          JSON.stringify({
            staleAt: Date.now() + (key.startsWith("getChallenge") ? 4 : 25) * 6e4,
            value,
          }),
          {
            expiration: { type: "EX", value: key.startsWith("getChallenge") ? 300 : 1800 },
          },
        );
      },
      delete: (k) => redis.del(k),
      resolveKey: resolveKey as never,
    },
  },
);
