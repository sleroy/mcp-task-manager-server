import { z } from 'zod';

export const TOOL_NAME = "assignToSprint";

export const TOOL_DESCRIPTION = `
Assigns or unassigns multiple stories/tasks to a sprint.
`;

export const TOOL_PARAMS = z.object({
    project_id: z.string().uuid("The project_id must be a valid UUID."),
    task_ids: z.array(z.string().uuid("Each task ID must be a valid UUID.")).min(1).max(100),
    sprint_id: z.string().uuid("The sprint_id must be a valid UUID.").nullable()
        .describe("Sprint to assign, or null to remove sprint assignment."),
});

export type AssignToSprintArgs = z.infer<typeof TOOL_PARAMS>;
