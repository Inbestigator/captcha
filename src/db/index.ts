import { hash } from "node:crypto";
import { createCache } from "@dressed/ws/cache";
import { createClient } from "@libsql/client";
import { RedisClient } from "bun";
import { createDM, getGuild } from "dressed";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { settingsTable, stagesTable } from "./schema";

const libsql = createClient({ url: process.env.DATABASE_URL as string, authToken: process.env.DATABASE_AUTH_TOKEN });

export const resolveKey = (key: string, args: string[]) => `${key.toString()}:${hash("sha1", JSON.stringify(args))}`;
export const redis = new RedisClient(process.env.REDIS_URL);
export const db = drizzle(libsql);
export const cache = createCache(
  {
    createDM,
    getGuild,
    async getSettings(guild: string) {
      const res = await db.select().from(settingsTable).where(eq(settingsTable.id, guild)).limit(1);
      return res[0] ?? null;
    },
    listStages: (guild: string) => db.select().from(stagesTable).where(eq(stagesTable.guild, guild)),
  },
  {
    logic: {
      async get(key) {
        const res = await redis.get(key);
        if (!res) return { state: "miss" };
        const data = JSON.parse(res);
        return { state: Date.now() < data.staleAt ? "hit" : "stale", ...data };
      },
      set: (key, value) => redis.set(key, JSON.stringify({ staleAt: Date.now() + 150e4, value }), "EX", 1800),
      delete: (k) => redis.del(k),
      resolveKey: resolveKey as never,
    },
  },
);
