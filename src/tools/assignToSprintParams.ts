import { z } from "zod";

export const TOOL_NAME = "assignToSprint";

export const TOOL_DESCRIPTION = `
Assigns or unassigns stories/tasks to a sprint by explicit IDs or lightweight selectors.
`;

const TaskStatusEnum = z.enum([
  "todo",
  "in-progress",
  "review",
  "done",
  "cancelled",
]);
const WorkItemTypeEnum = z.enum(["story", "task"]);

export const TOOL_PARAMS = z.object({
  project_id: z.string().uuid("The project_id must be a valid UUID."),
  task_ids: z
    .array(z.string().uuid("Each task ID must be a valid UUID."))
    .min(1)
    .max(100)
    .optional()
    .describe(
      "Explicit stories/tasks to assign. Optional when using selectors."
    ),
  sprint_id: z
    .string()
    .uuid("The sprint_id must be a valid UUID.")
    .nullable()
    .describe("Sprint to assign, or null to remove sprint assignment."),
  item_type: WorkItemTypeEnum.optional().describe(
    "Optional selector for stories or tasks. Epics are never assigned directly."
  ),
  status: TaskStatusEnum.optional().describe(
    "Optional selector for work item status."
  ),
  parent_task_id: z
    .string()
    .uuid("The parent_task_id must be a valid UUID.")
    .nullable()
    .optional()
    .describe(
      "Optional selector for direct children of a parent, or null for root work items."
    ),
  epic_id: z
    .string()
    .uuid("The epic_id must be a valid UUID.")
    .optional()
    .describe(
      "Optional selector that assigns matching descendant stories/tasks of an epic."
    ),
  milestone: z
    .string()
    .min(1)
    .max(128)
    .nullable()
    .optional()
    .describe(
      "Optional selector for a lightweight milestone label. If omitted and the target sprint has a milestone, that sprint milestone is used."
    ),
  include_subtasks: z
    .boolean()
    .optional()
    .default(false)
    .describe("When true, also assigns descendants of selected stories/tasks."),
});

export type AssignToSprintArgs = z.infer<typeof TOOL_PARAMS>;
