import { z } from 'zod';

export const TOOL_NAME = "createSprint";

export const TOOL_DESCRIPTION = `
Creates a sprint inside a project for planning and tracking executable task work.
Returns the full sprint object.
`;

const SprintStatusEnum = z.enum(['planned', 'active', 'closed']);

export const TOOL_PARAMS = z.object({
    project_id: z.string().uuid("The project_id must be a valid UUID.")
        .describe("The unique identifier (UUID) of the project that owns the sprint."),
    name: z.string().min(1, "Sprint name cannot be empty.").max(255, "Sprint name cannot exceed 255 characters.")
        .describe("Human-readable sprint name."),
    goal: z.string().max(1024, "Sprint goal cannot exceed 1024 characters.").nullable().optional()
        .describe("Optional sprint goal."),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "start_date must use YYYY-MM-DD.").nullable().optional()
        .describe("Optional sprint start date in YYYY-MM-DD format."),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "end_date must use YYYY-MM-DD.").nullable().optional()
        .describe("Optional sprint end date in YYYY-MM-DD format."),
    status: SprintStatusEnum.optional().default('planned')
        .describe("Optional initial sprint status. Defaults to 'planned'."),
});

export type CreateSprintArgs = z.infer<typeof TOOL_PARAMS>;
