import { z } from 'zod';

export const TOOL_NAME = "updateSprint";

export const TOOL_DESCRIPTION = `
Updates sprint metadata such as name, goal, dates, or status.
`;

const SprintStatusEnum = z.enum(['planned', 'active', 'closed']);

export const UPDATE_SPRINT_BASE_SCHEMA = z.object({
    project_id: z.string().uuid("The project_id must be a valid UUID."),
    sprint_id: z.string().uuid("The sprint_id must be a valid UUID."),
    name: z.string().min(1).max(255).optional(),
    goal: z.string().max(1024).nullable().optional(),
    description: z.string().max(1024).nullable().optional(),
    milestone: z.string().min(1).max(128).nullable().optional(),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    status: SprintStatusEnum.optional(),
});

export const TOOL_PARAMS = UPDATE_SPRINT_BASE_SCHEMA.refine(
    data => data.name !== undefined || data.goal !== undefined || data.description !== undefined || data.milestone !== undefined || data.start_date !== undefined || data.end_date !== undefined || data.status !== undefined,
    { message: "At least one sprint field must be provided." }
);

export type UpdateSprintArgs = z.infer<typeof TOOL_PARAMS>;
