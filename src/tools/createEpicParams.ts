import { z } from "zod";
import {
  MILESTONE_VS_SPRINT_GUIDANCE,
  WORK_ITEM_DESCRIPTION_GUIDANCE,
  WORK_ITEM_DESCRIPTION_MAX_LENGTH,
} from "./sharedParams.js";

export const TOOL_NAME = "createEpic";

export const TOOL_DESCRIPTION = `
Creates a top-level epic in a project.
`;

const TaskStatusEnum = z.enum([
  "todo",
  "in-progress",
  "review",
  "done",
  "cancelled",
]);
const TaskPriorityEnum = z.enum(["high", "medium", "low"]);

export const TOOL_PARAMS = z.object({
  project_id: z
    .string()
    .uuid("The project_id must be a valid UUID.")
    .describe(
      "The unique identifier (UUID) of the project to add the epic to."
    ),
  description: z
    .string()
    .min(1, "Epic description cannot be empty.")
    .max(
      WORK_ITEM_DESCRIPTION_MAX_LENGTH,
      `Epic description cannot exceed ${WORK_ITEM_DESCRIPTION_MAX_LENGTH} characters.`
    )
    .describe(WORK_ITEM_DESCRIPTION_GUIDANCE),
  milestone: z
    .string()
    .min(1)
    .max(128)
    .nullable()
    .optional()
    .describe(`Optional lightweight milestone label. ${MILESTONE_VS_SPRINT_GUIDANCE}`),
  priority: TaskPriorityEnum.optional()
    .default("medium")
    .describe("Optional epic priority. Defaults to 'medium'."),
  status: TaskStatusEnum.optional()
    .default("todo")
    .describe("Optional initial epic status. Defaults to 'todo'."),
});

export type CreateEpicArgs = z.infer<typeof TOOL_PARAMS>;
