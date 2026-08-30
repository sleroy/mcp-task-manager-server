import { z } from 'zod';

export const TOOL_NAME = "updateWorkItemsBatch";

export const TOOL_DESCRIPTION = `
Atomically updates multiple existing work items, including description, priority, parent, sprint assignment, and dependencies.
`;

const TaskPriorityEnum = z.enum(['high', 'medium', 'low']);

const BatchUpdateSchema = z.object({
    task_id: z.string().uuid(),
    description: z.string().min(1).max(1024).optional(),
    priority: TaskPriorityEnum.optional(),
    parent_task_id: z.string().uuid().nullable().optional(),
    sprint_id: z.string().uuid().nullable().optional(),
    dependencies: z.array(z.string().uuid()).max(50).optional(),
}).refine(
    data => data.description !== undefined || data.priority !== undefined || data.parent_task_id !== undefined || data.sprint_id !== undefined || data.dependencies !== undefined,
    { message: "Each update must provide at least one field." }
);

export const TOOL_PARAMS = z.object({
    project_id: z.string().uuid("The project_id must be a valid UUID."),
    updates: z.array(BatchUpdateSchema).min(1).max(100),
    dry_run: z.boolean().optional().default(false),
});

export type UpdateWorkItemsBatchArgs = z.infer<typeof TOOL_PARAMS>;
