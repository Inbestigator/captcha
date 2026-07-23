import { hash } from "node:crypto";
import { createCache } from "@dressed/ws/cache";
import { createDM, getGuild } from "dressed";
import { count, eq, sum } from "drizzle-orm";
import { db } from "./db.ts";
import { settingsTable, stagesTable } from "./schema.ts";

export const resolveKey = (key: string, args: string[]) => `${key.toString()}:${hash("sha1", JSON.stringify(args))}`;

export const startCache = (redis: {
  del: (k: string) => void;
  get: (k: string) => Promise<string | null>;
  keys: (s: string) => Promise<string[]>;
  set: (k: string, v: string) => void;
}) =>
  createCache(
    {
      createDM,
      getGuild,
      async getSettings(guild: string) {
        const res = await db.select().from(settingsTable).where(eq(settingsTable.id, guild)).limit(1);
        return res[0] ?? null;
      },
      async getStats() {
        const stagesPromise = db.select({ challenges: count(), fails: sum(stagesTable.fails) }).from(stagesTable);
        const keys = await redis.keys("check:*");
        const [[stages], ...checks] = await Promise.all([
          await stagesPromise,
          ...keys.map((key) => redis.get(key).then((v) => Number(v ?? 0))),
        ]);
        return {
          challenges: Number(stages?.challenges ?? 0),
          checks: checks.reduce((p, c) => p + c, 0),
          fails: Number(stages?.fails ?? 0),
        };
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
        set: (key, value) => redis.set(key, JSON.stringify({ staleAt: Date.now() + 150e4, value })),
        delete: (k) => redis.del(k),
        resolveKey: resolveKey as never,
      },
    },
  );
