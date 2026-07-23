import { randomUUID } from "node:crypto";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import themes from "../themes.json" with { type: "json" };

export const settingsTable = sqliteTable("settings", {
  id: text().primaryKey(),
  refresh: text("refresh", { enum: ["options", "theme"] }),
  actions: text("actions", { mode: "json" }).$type<("kick" | "timeout" | "dm")[]>().default([]).notNull(),
  logs: text(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .$defaultFn(() => new Date())
    .notNull(),
});

export const stagesTable = sqliteTable("stages", {
  id: text().$defaultFn(randomUUID).primaryKey(),
  guild: text().notNull(),
  theme: text("theme", { enum: Object.keys(themes) as [keyof typeof themes] }).notNull(),
  incorrect: text().notNull(),
  correct: text("correct", { mode: "json" }).$type<string[]>().notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .$defaultFn(() => new Date())
    .notNull(),
  fails: integer().default(0).notNull(),
});
