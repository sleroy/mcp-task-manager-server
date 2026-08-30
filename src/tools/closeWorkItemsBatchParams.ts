import { z } from 'zod';

export const TOOL_NAME = "closeWorkItemsBatch";

export const TOOL_DESCRIPTION = `
Atomically closes multiple work items. By default, closes descendants as well.
`;

export const TOOL_PARAMS = z.object({
    project_id: z.string().uuid("The project_id must be a valid UUID."),
    task_ids: z.array(z.string().uuid()).min(1).max(100),
    include_subtasks: z.boolean().optional().default(true),
    dry_run: z.boolean().optional().default(false),
});

export type CloseWorkItemsBatchArgs = z.infer<typeof TOOL_PARAMS>;
