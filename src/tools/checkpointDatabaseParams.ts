import { z } from "zod";

export const TOOL_NAME = "checkpointDatabase";

export const TOOL_DESCRIPTION = `
Forces a SQLite WAL checkpoint using TRUNCATE mode for the task-manager database.
Use this before committing the database file so pending changes in the -wal file are flushed into the main .db file.
Returns the checkpoint result from SQLite.
`;

export const TOOL_PARAMS = z.object({});

export type CheckpointDatabaseArgs = z.infer<typeof TOOL_PARAMS>;
