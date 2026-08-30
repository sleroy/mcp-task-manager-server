import { z } from 'zod';

export const TOOL_NAME = "createEpic";

export const TOOL_DESCRIPTION = `
Creates a top-level epic in a project.
`;

const TaskStatusEnum = z.enum(['todo', 'in-progress', 'review', 'done']);
const TaskPriorityEnum = z.enum(['high', 'medium', 'low']);

export const TOOL_PARAMS = z.object({
    project_id: z.string().uuid("The project_id must be a valid UUID.")
        .describe("The unique identifier (UUID) of the project to add the epic to."),
    description: z.string().min(1, "Epic description cannot be empty.").max(1024, "Epic description cannot exceed 1024 characters.")
        .describe("The epic description."),
    milestone: z.string().min(1).max(128).nullable().optional()
        .describe("Optional lightweight milestone label."),
    priority: TaskPriorityEnum.optional().default('medium')
        .describe("Optional epic priority. Defaults to 'medium'."),
    status: TaskStatusEnum.optional().default('todo')
        .describe("Optional initial epic status. Defaults to 'todo'."),
});

export type CreateEpicArgs = z.infer<typeof TOOL_PARAMS>;
