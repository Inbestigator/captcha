import { hash } from "node:crypto";
import { createCache } from "@dressed/ws/cache";
import { createDM, getGuild, getRole } from "dressed";
import { count, eq, sql } from "drizzle-orm";
import { db } from "./db.ts";
import { checksTable, settingsTable, stagesTable, triggerRolesTable } from "./schema.ts";

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
      getRole,
      async getGuildChecks(guild: string) {
        const [{ challenges = 0 } = {}] = await db
          .select({ challenges: count() })
          .from(checksTable)
          .where(eq(checksTable.guild, guild));
        return challenges;
      },
      async getSettings(guild: string) {
        const res = await db.select().from(settingsTable).where(eq(settingsTable.id, guild)).limit(1);
        return res[0] ?? null;
      },
      async getStats() {
        const [[{ challenges = 0 } = {}], [{ checks = 0, fails = 0 } = {}]] = await db.batch([
          db.select({ challenges: count() }).from(stagesTable),
          db
            .select({ fails: sql<number>`coalesce(sum(${checksTable.failed} > 0), 0)`, checks: count() })
            .from(checksTable),
        ]);
        return { challenges, checks, fails };
      },
      listStages: (guild: string) => db.select().from(stagesTable).where(eq(stagesTable.guild, guild)),
      listTriggerRoles: (guild: string) =>
        db.select().from(triggerRolesTable).where(eq(triggerRolesTable.guild, guild)),
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
