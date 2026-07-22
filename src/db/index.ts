import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const globalForDb = globalThis as typeof globalThis & {
  __fleekTrackPool?: Pool;
};

function getPool(): Pool {
  if (globalForDb.__fleekTrackPool) {
    return globalForDb.__fleekTrackPool;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    max: 1,                    // Only 1 connection per serverless function
    idleTimeoutMillis: 20000,  // Close idle connections after 20s
    connectionTimeoutMillis: 10000, // Timeout after 10s if can't connect
  });

  globalForDb.__fleekTrackPool = pool;
  return pool;
}

// Lazy pool — only connects when actually used at runtime, not at build time
export const pool = new Proxy({} as Pool, {
  get(_target, prop) {
    const realPool = getPool();
    const value = (realPool as unknown as Record<string | symbol, unknown>)[prop];
    if (typeof value === "function") {
      return value.bind(realPool);
    }
    return value;
  },
});

export const db = drizzle(pool, { schema });
