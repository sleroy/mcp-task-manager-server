import { z } from 'zod';

export const TOOL_NAME = "getSprintBacklog";

export const TOOL_DESCRIPTION = `
Returns a sprint backlog grouped by available epic/story hierarchy.
`;

export const TOOL_PARAMS = z.object({
    project_id: z.string().uuid("The project_id must be a valid UUID."),
    sprint_id: z.string().uuid("The sprint_id must be a valid UUID."),
});

export type GetSprintBacklogArgs = z.infer<typeof TOOL_PARAMS>;
