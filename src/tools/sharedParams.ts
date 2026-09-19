/**
 * Shared parameter constants and guidance strings used across MCP tool schemas.
 *
 * Keeping these in one place avoids drift between tools (e.g. the addTask,
 * updateTask, batch, and import schemas all share the same description limit).
 */

/**
 * Maximum length for a work item description.
 *
 * Descriptions are intended to be rich enough to act as a self-contained
 * prompt for a coding agent, so this is generous. The database stores the
 * value as TEXT with no length constraint; this cap only guards against
 * accidentally unbounded input.
 */
export const WORK_ITEM_DESCRIPTION_MAX_LENGTH = 8192;

/** Shared human-readable guidance for description fields. */
export const WORK_ITEM_DESCRIPTION_GUIDANCE =
  `The description of the work item (1-${WORK_ITEM_DESCRIPTION_MAX_LENGTH} characters). ` +
  "This can be a short summary or a detailed, self-contained prompt that a coding " +
  "agent can act on directly (context, acceptance criteria, constraints, and steps).";

/**
 * Guidance clarifying that milestones and sprints are two alternative ways to
 * group work and should not be combined on the same items. Mixing them tends to
 * create duplicated planning and duplicated tasks.
 */
export const MILESTONE_VS_SPRINT_GUIDANCE =
  "Use EITHER milestones OR sprints to group work, never both. Combining them on " +
  "the same work items leads to duplicated planning and duplicated tasks.";
