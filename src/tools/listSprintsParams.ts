import { z } from 'zod';

export const TOOL_NAME = "listSprints";

export const TOOL_DESCRIPTION = `
Lists sprints for a project, optionally filtered by sprint status.
`;

const SprintStatusEnum = z.enum(['planned', 'active', 'closed']);

export const TOOL_PARAMS = z.object({
    project_id: z.string().uuid("The project_id must be a valid UUID.")
        .describe("The unique identifier (UUID) of the project whose sprints should be listed."),
    status: SprintStatusEnum.optional()
        .describe("Optional filter to return only sprints matching the specified status."),
    milestone: z.string().min(1).max(128).nullable().optional()
        .describe("Optional milestone filter. Pass null for sprints without a milestone."),
});

export type ListSprintsArgs = z.infer<typeof TOOL_PARAMS>;
