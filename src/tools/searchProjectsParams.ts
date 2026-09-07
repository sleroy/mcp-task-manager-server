import { z } from 'zod';

export const TOOL_NAME = "searchProjects";

export const TOOL_DESCRIPTION = `
Discovers projects and their IDs before using a project-scoped tool.
Call without a query to list the most recently created projects, or provide a
case-insensitive name or project-ID fragment to narrow the results.
Returns project metadata including project_id, name, and created_at.
`;

export const TOOL_PARAMS = z.object({
    query: z.string()
        .trim()
        .min(1, "Search query cannot be empty.")
        .max(255, "Search query cannot exceed 255 characters.")
        .optional()
        .describe("Optional case-insensitive project name or project-ID fragment. Omit to discover recent projects."),
    limit: z.number()
        .int("Limit must be an integer.")
        .min(1, "Limit must be at least 1.")
        .max(100, "Limit cannot exceed 100.")
        .optional()
        .default(25)
        .describe("Maximum number of projects to return (default 25, maximum 100)."),
});

export type SearchProjectsArgs = z.infer<typeof TOOL_PARAMS>;
