import { z } from 'zod';

export const TOOL_NAME = "importBacklog";

export const TOOL_DESCRIPTION = `
Imports an agent-generated backlog of epics with nested stories and tasks, optionally assigning stories/tasks to a sprint.
`;

const TaskStatusEnum = z.enum(['todo', 'in-progress', 'review', 'done']);
const TaskPriorityEnum = z.enum(['high', 'medium', 'low']);

const TaskNodeSchema = z.object({
    client_id: z.string().min(1).max(128).optional(),
    description: z.string().min(1).max(1024),
    priority: TaskPriorityEnum.optional(),
    status: TaskStatusEnum.optional(),
    sprint_id: z.string().uuid().nullable().optional(),
    milestone: z.string().min(1).max(128).nullable().optional(),
});

const StoryNodeSchema = TaskNodeSchema.extend({
    tasks: z.array(TaskNodeSchema).max(100).optional(),
});

const EpicNodeSchema = TaskNodeSchema.extend({
    stories: z.array(StoryNodeSchema).max(100).optional(),
    tasks: z.array(TaskNodeSchema).max(100).optional(),
});

export const TOOL_PARAMS = z.object({
    project_id: z.string().uuid("The project_id must be a valid UUID."),
    sprint_id: z.string().uuid("The sprint_id must be a valid UUID.").nullable().optional(),
    epics: z.array(EpicNodeSchema).min(1).max(50),
    dry_run: z.boolean().optional().default(false),
});

export type ImportBacklogArgs = z.infer<typeof TOOL_PARAMS>;
