import { z } from 'zod';

export const TOOL_NAME = "startSprint";

export const TOOL_DESCRIPTION = `
Marks a sprint active. By default, other active sprints in the same project are moved back to planned.
`;

export const TOOL_PARAMS = z.object({
    project_id: z.string().uuid("The project_id must be a valid UUID."),
    sprint_id: z.string().uuid("The sprint_id must be a valid UUID."),
    make_exclusive: z.boolean().optional().default(true),
});

export type StartSprintArgs = z.infer<typeof TOOL_PARAMS>;
