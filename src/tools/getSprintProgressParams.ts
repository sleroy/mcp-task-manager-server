import { z } from 'zod';

export const TOOL_NAME = "getSprintProgress";

export const TOOL_DESCRIPTION = `
Computes sprint progress from assigned tasks, including done/open counts and status breakdown.
`;

export const TOOL_PARAMS = z.object({
    project_id: z.string().uuid("The project_id must be a valid UUID.")
        .describe("The unique identifier (UUID) of the project that owns the sprint."),
    sprint_id: z.string().uuid("The sprint_id must be a valid UUID.")
        .describe("The unique identifier (UUID) of the sprint to inspect."),
});

export type GetSprintProgressArgs = z.infer<typeof TOOL_PARAMS>;
