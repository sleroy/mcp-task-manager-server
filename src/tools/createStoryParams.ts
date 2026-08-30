import { z } from 'zod';

export const TOOL_NAME = "createStory";

export const TOOL_DESCRIPTION = `
Creates a story under an epic, optionally assigning it to a sprint.
`;

const TaskStatusEnum = z.enum(['todo', 'in-progress', 'review', 'done']);
const TaskPriorityEnum = z.enum(['high', 'medium', 'low']);

export const TOOL_PARAMS = z.object({
    project_id: z.string().uuid("The project_id must be a valid UUID.")
        .describe("The unique identifier (UUID) of the project to add the story to."),
    epic_id: z.string().uuid("The epic_id must be a valid UUID.")
        .describe("The epic that owns this story."),
    description: z.string().min(1, "Story description cannot be empty.").max(1024, "Story description cannot exceed 1024 characters.")
        .describe("The story description."),
    sprint_id: z.string().uuid("The sprint_id must be a valid UUID.").nullable().optional()
        .describe("Optional sprint assignment."),
    priority: TaskPriorityEnum.optional().default('medium')
        .describe("Optional story priority. Defaults to 'medium'."),
    status: TaskStatusEnum.optional().default('todo')
        .describe("Optional initial story status. Defaults to 'todo'."),
});

export type CreateStoryArgs = z.infer<typeof TOOL_PARAMS>;
