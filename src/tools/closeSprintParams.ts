import { z } from 'zod';

export const TOOL_NAME = "closeSprint";

export const TOOL_DESCRIPTION = `
Closes a sprint and optionally closes all work items assigned to that sprint.
`;

export const TOOL_PARAMS = z.object({
    project_id: z.string().uuid("The project_id must be a valid UUID.")
        .describe("The unique identifier (UUID) of the project that owns the sprint."),
    sprint_id: z.string().uuid("The sprint_id must be a valid UUID.")
        .describe("The unique identifier (UUID) of the sprint to close."),
    close_tasks: z.boolean().optional().default(true)
        .describe("When true, marks all sprint work items as done before closing the sprint. Defaults to true."),
});

export type CloseSprintArgs = z.infer<typeof TOOL_PARAMS>;
