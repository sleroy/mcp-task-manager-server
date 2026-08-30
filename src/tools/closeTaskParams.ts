import { z } from 'zod';

export const TOOL_NAME = "closeTask";

export const TOOL_DESCRIPTION = `
Marks a task, story, or epic as done. By default, also closes all nested subtasks.
`;

export const TOOL_PARAMS = z.object({
    project_id: z.string().uuid("The project_id must be a valid UUID.")
        .describe("The unique identifier (UUID) of the project containing the work item."),
    task_id: z.string().uuid("The task_id must be a valid UUID.")
        .describe("The work item to close."),
    include_subtasks: z.boolean().optional().default(true)
        .describe("When true, closes all descendants as well. Defaults to true."),
});

export type CloseTaskArgs = z.infer<typeof TOOL_PARAMS>;
