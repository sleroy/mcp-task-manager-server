import { z } from "zod";
import {
  MILESTONE_VS_SPRINT_GUIDANCE,
  WORK_ITEM_DESCRIPTION_GUIDANCE,
  WORK_ITEM_DESCRIPTION_MAX_LENGTH,
} from "./sharedParams.js";

export const TOOL_NAME = "addTask";

export const TOOL_DESCRIPTION = `
Adds a new task to a specified project within the Task Management Server.
Requires the project ID and a description for the task. The description can be a
detailed, self-contained prompt that a coding agent can act on directly.
Optionally accepts a list of dependency task IDs, a priority level, and an initial status.
${MILESTONE_VS_SPRINT_GUIDANCE}
Returns the full details of the newly created task upon success.
`;

// Allowed enum values for status and priority
const TaskStatusEnum = z.enum([
  "todo",
  "in-progress",
  "review",
  "done",
  "cancelled",
]);
const TaskPriorityEnum = z.enum(["high", "medium", "low"]);
const WorkItemTypeEnum = z.enum(["epic", "story", "task"]);

// Zod schema for the parameters, matching FR-002 and addTaskTool.md spec
export const TOOL_PARAMS = z.object({
  project_id: z
    .string()
    .uuid("The project_id must be a valid UUID.")
    .describe(
      "The unique identifier (UUID) of the project to add the task to. This project must already exist."
    ), // Required, UUID format

  description: z
    .string()
    .min(1, "Task description cannot be empty.")
    .max(
      WORK_ITEM_DESCRIPTION_MAX_LENGTH,
      `Task description cannot exceed ${WORK_ITEM_DESCRIPTION_MAX_LENGTH} characters.`
    )
    .describe(WORK_ITEM_DESCRIPTION_GUIDANCE), // Required, length limits

  item_type: WorkItemTypeEnum.optional()
    .default("task")
    .describe(
      "Optional work item type. Use 'epic' for major initiatives, 'story' for user stories, and 'task' for executable work. Defaults to 'task'."
    ),

  parent_task_id: z
    .string()
    .uuid("The parent_task_id must be a valid UUID.")
    .nullable()
    .optional()
    .describe(
      "Optional parent work item ID. Stories can be parented by epics; tasks can be parented by stories or epics."
    ),

  sprint_id: z
    .string()
    .uuid("The sprint_id must be a valid UUID.")
    .nullable()
    .optional()
    .describe(
      `Optional sprint assignment. Epics cannot be assigned directly to a sprint. ${MILESTONE_VS_SPRINT_GUIDANCE}`
    ),

  milestone: z
    .string()
    .min(1, "Milestone cannot be empty.")
    .max(128, "Milestone cannot exceed 128 characters.")
    .nullable()
    .optional()
    .describe(
      `Optional lightweight milestone label such as M0.1. This does not require using epics. ${MILESTONE_VS_SPRINT_GUIDANCE}`
    ),

  dependencies: z
    .array(z.string().describe("A task ID that this new task depends on.")) // Allow any string for now, existence checked in service (or deferred)
    .max(50, "A task cannot have more than 50 dependencies.")
    .optional()
    .describe(
      "An optional list of task IDs (strings) that must be completed before this task can start (max 50)."
    ), // Optional, array of strings, count limit

  priority: TaskPriorityEnum.optional()
    .default("medium") // Default value
    .describe("Optional task priority. Defaults to 'medium' if not specified."), // Optional, enum, default

  status: TaskStatusEnum.optional()
    .default("todo") // Default value
    .describe(
      "Optional initial status of the task. Defaults to 'todo' if not specified."
    ), // Optional, enum, default
});

// Define the expected type for arguments based on the Zod schema
export type AddTaskArgs = z.infer<typeof TOOL_PARAMS>;
