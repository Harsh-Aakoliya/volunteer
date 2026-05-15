import { createClient } from "redis";
import dotenv from "dotenv";

dotenv.config();

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

let client = null;
let isConnected = false;

export async function connectRedis() {
  if (client && isConnected) return client;

  client = createClient({ url: REDIS_URL });

  client.on("error", (err) => {
    console.error("Redis error:", err.message);
    isConnected = false;
  });

  client.on("connect", () => {
    console.log(`✅ Redis connected (${REDIS_URL})`);
    isConnected = true;
  });

  client.on("end", () => {
    isConnected = false;
  });

  try {
    await client.connect();
  } catch (err) {
    console.warn("⚠️  Redis unavailable — caching disabled:", err.message);
    client = null;
    isConnected = false;
  }

  return client;
}

export function getRedis() {
  return client;
}

export function isRedisConnected() {
  return isConnected && client !== null;
}

/**
 * Cache-aside helper.
 * Returns cached value if present, otherwise calls `fetcher()`,
 * stores the result with the given TTL, and returns it.
 */
export async function cacheGet(key, fetcher, ttlSeconds = 60) {
  if (!isConnected || !client) return fetcher();

  try {
    const cached = await client.get(key);
    if (cached !== null) return JSON.parse(cached);
  } catch {
    // cache miss — fall through
  }

  const fresh = await fetcher();

  try {
    await client.set(key, JSON.stringify(fresh), { EX: ttlSeconds });
  } catch {
    // ignore write errors
  }

  return fresh;
}

/**
 * Invalidate one or more cache keys.
 */
export async function cacheInvalidate(...keys) {
  if (!isConnected || !client) return;
  try {
    await client.del(keys);
  } catch {
    // ignore
  }
}

export default { connectRedis, getRedis, isRedisConnected, cacheGet, cacheInvalidate };
