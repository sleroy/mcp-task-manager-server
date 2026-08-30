import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { TaskService } from "../services/TaskService.js";
import { NotFoundError } from "../utils/errors.js";
import { logger } from '../utils/logger.js';
import { GetSprintBacklogArgs, TOOL_DESCRIPTION, TOOL_NAME, TOOL_PARAMS } from "./getSprintBacklogParams.js";

export const getSprintBacklogTool = (server: McpServer, taskService: TaskService): void => {
    const processRequest = async (args: GetSprintBacklogArgs) => {
        try {
            const backlog = await taskService.getSprintBacklog(args.project_id, args.sprint_id);
            return { content: [{ type: "text" as const, text: JSON.stringify(backlog) }] };
        } catch (error: unknown) {
            logger.error(`[${TOOL_NAME}] Error processing request:`, error);
            if (error instanceof NotFoundError) {
                throw new McpError(ErrorCode.InvalidParams, error.message);
            }
            throw new McpError(ErrorCode.InternalError, error instanceof Error ? error.message : 'An unknown error occurred while getting sprint backlog.');
        }
    };

    server.tool(TOOL_NAME, TOOL_DESCRIPTION, TOOL_PARAMS.shape, processRequest);
    logger.info(`[${TOOL_NAME}] Tool registered successfully.`);
};
