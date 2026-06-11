import { Redis } from "@upstash/redis";

// Global "lineups played" counter, stored in Upstash Redis.
// Set up: add a free Redis (Upstash) from the Vercel Storage tab — it injects
// the env vars below automatically. Works locally too if you set them in
// .env.local. If unset, the API returns { count: null } and the UI hides the
// counter (so dev/build never break).

const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;
const KEY = "dictator-mbappe:plays";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!redis) return Response.json({ count: null });
  try {
    const count = (await redis.get<number>(KEY)) ?? 0;
    return Response.json({ count });
  } catch {
    return Response.json({ count: null });
  }
}

export async function POST() {
  if (!redis) return Response.json({ count: null });
  try {
    const count = await redis.incr(KEY);
    return Response.json({ count });
  } catch {
    return Response.json({ count: null });
  }
}
