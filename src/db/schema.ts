import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const stagesTable = pgTable("stages", {
  id: uuid().defaultRandom().primaryKey(),
  guild: text().notNull(),
  theme: text().notNull().$type<"light" | "scooter" | "bus" | "check">(),
  incorrect: text().notNull(),
  correct: text().array().notNull(),
  createdAt: timestamp().defaultNow().notNull(),
});
