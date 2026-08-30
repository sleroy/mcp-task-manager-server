import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { TaskService } from "../services/TaskService.js";
import { NotFoundError } from "../utils/errors.js";
import { logger } from '../utils/logger.js';
import { CloseSprintArgs, TOOL_DESCRIPTION, TOOL_NAME, TOOL_PARAMS } from "./closeSprintParams.js";

export const closeSprintTool = (server: McpServer, taskService: TaskService): void => {
    const processRequest = async (args: CloseSprintArgs) => {
        try {
            const result = await taskService.closeSprint(args.project_id, args.sprint_id, args.close_tasks);
            return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
        } catch (error: unknown) {
            logger.error(`[${TOOL_NAME}] Error processing request:`, error);
            if (error instanceof NotFoundError) {
                throw new McpError(ErrorCode.InvalidParams, error.message);
            }
            throw new McpError(ErrorCode.InternalError, error instanceof Error ? error.message : 'An unknown error occurred while closing the sprint.');
        }
    };

    server.tool(TOOL_NAME, TOOL_DESCRIPTION, TOOL_PARAMS.shape, processRequest);
    logger.info(`[${TOOL_NAME}] Tool registered successfully.`);
};
