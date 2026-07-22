import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./drizzle",
  schema: "./src/db/schema.ts",
  dialect: process.env.DATABASE_AUTH_TOKEN ? "turso" : "sqlite",
  dbCredentials: { url: process.env.DATABASE_URL as string, authToken: process.env.DATABASE_AUTH_TOKEN },
});
