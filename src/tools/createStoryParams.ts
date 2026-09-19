import { z } from "zod";
import {
  MILESTONE_VS_SPRINT_GUIDANCE,
  WORK_ITEM_DESCRIPTION_GUIDANCE,
  WORK_ITEM_DESCRIPTION_MAX_LENGTH,
} from "./sharedParams.js";

export const TOOL_NAME = "createStory";

export const TOOL_DESCRIPTION = `
Creates a story under an epic, optionally assigning it to a sprint.
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
      "The unique identifier (UUID) of the project to add the story to."
    ),
  epic_id: z
    .string()
    .uuid("The epic_id must be a valid UUID.")
    .describe("The epic that owns this story."),
  description: z
    .string()
    .min(1, "Story description cannot be empty.")
    .max(
      WORK_ITEM_DESCRIPTION_MAX_LENGTH,
      `Story description cannot exceed ${WORK_ITEM_DESCRIPTION_MAX_LENGTH} characters.`
    )
    .describe(WORK_ITEM_DESCRIPTION_GUIDANCE),
  sprint_id: z
    .string()
    .uuid("The sprint_id must be a valid UUID.")
    .nullable()
    .optional()
    .describe(`Optional sprint assignment. ${MILESTONE_VS_SPRINT_GUIDANCE}`),
  milestone: z
    .string()
    .min(1)
    .max(128)
    .nullable()
    .optional()
    .describe(`Optional lightweight milestone label. ${MILESTONE_VS_SPRINT_GUIDANCE}`),
  priority: TaskPriorityEnum.optional()
    .default("medium")
    .describe("Optional story priority. Defaults to 'medium'."),
  status: TaskStatusEnum.optional()
    .default("todo")
    .describe("Optional initial story status. Defaults to 'todo'."),
});

export type CreateStoryArgs = z.infer<typeof TOOL_PARAMS>;
