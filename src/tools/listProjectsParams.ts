import { z } from "zod";

export const TOOL_NAME = "listProjects";

export const TOOL_DESCRIPTION = `
Lists all projects in the Task Management Server database.
Use this to discover existing projects and their unique identifiers (UUIDs)
before calling tools that require a project_id.
Returns an array of project objects, each with project_id, name, and created_at,
ordered by creation date (newest first).
`;

// This tool takes no parameters; it always returns every project.
export const TOOL_PARAMS = {};

const toolParamsSchema = z.object(TOOL_PARAMS);

export type ListProjectsArgs = z.infer<typeof toolParamsSchema>;
