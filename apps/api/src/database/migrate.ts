import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";
import { env } from "../config/env";

const MIGRATIONS_DIR = path.join(import.meta.dir, "migrations");

async function run(): Promise<void> {
  const sql = postgres(env.DATABASE_URL, { max: 1 });

  await sql`
    CREATE TABLE IF NOT EXISTS _migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  const files = (await readdir(MIGRATIONS_DIR))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  const appliedRows = await sql<{ name: string }[]>`SELECT name FROM _migrations`;
  const applied = new Set(appliedRows.map((row) => row.name));

  for (const file of files) {
    if (applied.has(file)) continue;
    const contents = await readFile(path.join(MIGRATIONS_DIR, file), "utf-8");
    console.log(`Applying migration: ${file}`);
    await sql.begin(async (tx) => {
      await tx.unsafe(contents);
      await tx`INSERT INTO _migrations (name) VALUES (${file})`;
    });
  }

  console.log("Migrations up to date.");
  await sql.end();
}

run().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
