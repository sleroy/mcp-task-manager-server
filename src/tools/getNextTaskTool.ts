import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import {
  TOOL_NAME,
  TOOL_DESCRIPTION,
  TOOL_PARAMS,
  GetNextTaskArgs,
} from "./getNextTaskParams.js";
import { TaskService } from "../services/TaskService.js";
import { logger } from "../utils/logger.js";
import { NotFoundError } from "../utils/errors.js";

/**
 * Registers the getNextTask tool with the MCP server.
 *
 * @param server - The McpServer instance.
 * @param taskService - An instance of the TaskService.
 */
export const getNextTaskTool = (
  server: McpServer,
  taskService: TaskService
): void => {
  const processRequest = async (args: GetNextTaskArgs) => {
    logger.info(`[${TOOL_NAME}] Received request with args:`, args);
    try {
      const shouldReturnSelection =
        args.include_explanations === true ||
        args.max_complexity !== undefined ||
        args.limit !== undefined;

      // Format the successful response
      if (shouldReturnSelection) {
        const selection = await taskService.getNextTaskCandidates(
          args.project_id,
          args.sprint_id,
          {
            limit: args.limit,
            max_complexity: args.max_complexity,
          }
        );
        logger.info(
          `[${TOOL_NAME}] Ranked next task selection returned for project ${args.project_id}`
        );
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(selection),
            },
          ],
        };
      }

      const nextTask = await taskService.getNextTask(
        args.project_id,
        args.sprint_id
      );
      if (nextTask) {
        logger.info(
          `[${TOOL_NAME}] Next task found: ${nextTask.task_id} in project ${args.project_id}`
        );
      } else {
        logger.info(
          `[${TOOL_NAME}] No ready task found for project ${args.project_id}`
        );
      }

      return {
        content: [
          {
            type: "text" as const,
            // Return the legacy task/null shape unless candidate options are requested.
            text: JSON.stringify(nextTask),
          },
        ],
      };
    } catch (error: unknown) {
      // Handle potential errors
      logger.error(`[${TOOL_NAME}] Error processing request:`, error);

      if (error instanceof NotFoundError) {
        // Project not found
        throw new McpError(ErrorCode.InvalidParams, error.message);
      } else {
        // Generic internal error
        const message =
          error instanceof Error
            ? error.message
            : "An unknown error occurred while getting the next task.";
        throw new McpError(ErrorCode.InternalError, message);
      }
    }
  };

  // Register the tool with the server
  server.tool(TOOL_NAME, TOOL_DESCRIPTION, TOOL_PARAMS.shape, processRequest);

  logger.info(`[${TOOL_NAME}] Tool registered successfully.`);
};
