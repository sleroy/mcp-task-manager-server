import { z } from "zod";

export const TOOL_NAME = "getNextTask";

export const TOOL_DESCRIPTION = `
Identifies and returns the next actionable executable task within a specified project.
A task is considered actionable if its status is 'todo' and all its dependencies (if any) have a terminal status of 'done' or 'cancelled'.
If multiple tasks are ready, candidates are ranked by dependency graph impact, complexity, priority, and creation date.
By default this returns the single best task, or null if no task is currently ready.
Set limit to 2 or more, max_complexity, or include_explanations to return a ranked candidate selection with explanations and blocked graph summary.
`;

// Zod schema for the parameters, matching FR-007 and getNextTaskTool.md spec
export const TOOL_PARAMS = z.object({
  project_id: z
    .string()
    .uuid("The project_id must be a valid UUID.")
    .describe(
      "The unique identifier (UUID) of the project to find the next task for."
    ), // Required, UUID format

  sprint_id: z
    .string()
    .uuid("The sprint_id must be a valid UUID.")
    .optional()
    .describe(
      "Optional sprint ID. If omitted, the most recent active sprint is used when one exists; otherwise the next project-level task is returned."
    ),

  limit: z
    .number()
    .int("limit must be an integer.")
    .min(1, "limit must be at least 1.")
    .max(10, "limit cannot exceed 10.")
    .optional()
    .describe(
      "Optional number of ranked task candidates to return. Use 3 to get the three best next tasks."
    ),

  max_complexity: z
    .enum(["low", "medium", "high"])
    .optional()
    .describe(
      "Optional complexity ceiling for returned candidates. Complexity is estimated from dependencies, subtasks, and description size."
    ),

  include_explanations: z
    .boolean()
    .optional()
    .describe(
      "Optional. When true, returns ranked candidate metadata and blocked graph summary even when limit is 1."
    ),
});

// Define the expected type for arguments based on the Zod schema
export type GetNextTaskArgs = z.infer<typeof TOOL_PARAMS>;
