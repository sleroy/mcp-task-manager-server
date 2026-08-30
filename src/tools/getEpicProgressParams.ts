import { z } from 'zod';

export const TOOL_NAME = "getEpicProgress";

export const TOOL_DESCRIPTION = `
Computes progress for an epic from its descendant stories and tasks.
`;

export const TOOL_PARAMS = z.object({
    project_id: z.string().uuid("The project_id must be a valid UUID."),
    epic_id: z.string().uuid("The epic_id must be a valid UUID."),
});

export type GetEpicProgressArgs = z.infer<typeof TOOL_PARAMS>;
