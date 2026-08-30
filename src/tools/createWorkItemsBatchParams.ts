import { z } from 'zod';

export const TOOL_NAME = "createWorkItemsBatch";

export const TOOL_DESCRIPTION = `
Atomically creates multiple epics, stories, and tasks. Items may use client_id values so later parents or dependencies can reference earlier items in the same batch.
`;

const TaskStatusEnum = z.enum(['todo', 'in-progress', 'review', 'done']);
const TaskPriorityEnum = z.enum(['high', 'medium', 'low']);
const WorkItemTypeEnum = z.enum(['epic', 'story', 'task']);

const BatchItemSchema = z.object({
    client_id: z.string().min(1).max(128).optional(),
    description: z.string().min(1).max(1024),
    item_type: WorkItemTypeEnum.optional().default('task'),
    parent_task_id: z.string().uuid().nullable().optional(),
    parent_client_id: z.string().min(1).max(128).optional(),
    sprint_id: z.string().uuid().nullable().optional(),
    dependencies: z.array(z.string().uuid()).max(50).optional(),
    dependency_client_ids: z.array(z.string().min(1).max(128)).max(50).optional(),
    priority: TaskPriorityEnum.optional().default('medium'),
    status: TaskStatusEnum.optional().default('todo'),
});

export const TOOL_PARAMS = z.object({
    project_id: z.string().uuid("The project_id must be a valid UUID."),
    items: z.array(BatchItemSchema).min(1).max(100),
    dry_run: z.boolean().optional().default(false),
});

export type CreateWorkItemsBatchArgs = z.infer<typeof TOOL_PARAMS>;
