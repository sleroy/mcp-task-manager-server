import { z } from 'zod';

export const TOOL_NAME = "listEpics";

export const TOOL_DESCRIPTION = `
Lists project epics, optionally including nested stories and tasks.
`;

const TaskStatusEnum = z.enum(['todo', 'in-progress', 'review', 'done']);

export const TOOL_PARAMS = z.object({
    project_id: z.string().uuid("The project_id must be a valid UUID.")
        .describe("The unique identifier (UUID) of the project whose epics should be listed."),
    status: TaskStatusEnum.optional()
        .describe("Optional filter to return only epics with this status."),
    include_subtasks: z.boolean().optional().default(true)
        .describe("Optional flag to include nested stories and tasks. Defaults to true."),
});

export type ListEpicsArgs = z.infer<typeof TOOL_PARAMS>;
