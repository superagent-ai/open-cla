import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import { getConfig } from "../config.js";
import * as schema from "./schema.js";

export type DbClient = NodePgDatabase<typeof schema>;

let pool: pg.Pool | undefined;
let db: DbClient | undefined;

export function getDb(): DbClient {
  if (!db) {
    const config = getConfig();
    pool = new pg.Pool({
      connectionString: config.DATABASE_URL,
      max: config.NODE_ENV === "production" ? 10 : 3
    });
    db = drizzle(pool, { schema });
  }

  return db;
}

export async function closeDb(): Promise<void> {
  await pool?.end();
  pool = undefined;
  db = undefined;
}
