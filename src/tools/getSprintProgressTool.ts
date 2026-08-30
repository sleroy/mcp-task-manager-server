import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { TaskService } from "../services/TaskService.js";
import { NotFoundError } from "../utils/errors.js";
import { logger } from '../utils/logger.js';
import { GetSprintProgressArgs, TOOL_DESCRIPTION, TOOL_NAME, TOOL_PARAMS } from "./getSprintProgressParams.js";

export const getSprintProgressTool = (server: McpServer, taskService: TaskService): void => {
    const processRequest = async (args: GetSprintProgressArgs) => {
        try {
            const progress = await taskService.getSprintProgress(args.project_id, args.sprint_id);
            return { content: [{ type: "text" as const, text: JSON.stringify(progress) }] };
        } catch (error: unknown) {
            logger.error(`[${TOOL_NAME}] Error processing request:`, error);
            if (error instanceof NotFoundError) {
                throw new McpError(ErrorCode.InvalidParams, error.message);
            }
            throw new McpError(ErrorCode.InternalError, error instanceof Error ? error.message : 'An unknown error occurred while computing sprint progress.');
        }
    };

    server.tool(TOOL_NAME, TOOL_DESCRIPTION, TOOL_PARAMS.shape, processRequest);
    logger.info(`[${TOOL_NAME}] Tool registered successfully.`);
};
