#!/usr/bin/env node
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const dbPath =
  process.argv[2] ?? process.env.DATABASE_PATH ?? "./data/taskmanager.db";
const resolvedDbPath = path.resolve(dbPath);

if (!fs.existsSync(resolvedDbPath)) {
  console.error(`Database not found: ${resolvedDbPath}`);
  process.exit(1);
}

const db = new Database(resolvedDbPath);

try {
  const [result = { busy: 0, log: 0, checkpointed: 0 }] = db.pragma(
    "wal_checkpoint(TRUNCATE)"
  );
  const output = {
    database_path: resolvedDbPath,
    mode: "TRUNCATE",
    busy: result.busy,
    log: result.log,
    checkpointed: result.checkpointed,
  };
  console.log(JSON.stringify(output, null, 2));

  if (result.busy !== 0 || result.log !== result.checkpointed) {
    console.error(
      `SQLite WAL checkpoint did not fully complete: busy=${result.busy}, log=${result.log}, checkpointed=${result.checkpointed}`
    );
    process.exitCode = 2;
  }
} finally {
  db.close();
}
