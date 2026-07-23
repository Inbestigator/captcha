import { cache } from "../src/db.ts";

export async function GET() {
  const stats = await cache.getStats();
  return new Response(JSON.stringify(stats), {
    headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=1800, s-maxage=1800" },
  });
}
