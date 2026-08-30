import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { TaskService } from "../services/TaskService.js";
import { NotFoundError, ValidationError } from "../utils/errors.js";
import { logger } from '../utils/logger.js';
import { CreateEpicArgs, TOOL_DESCRIPTION, TOOL_NAME, TOOL_PARAMS } from "./createEpicParams.js";

export const createEpicTool = (server: McpServer, taskService: TaskService): void => {
    const processRequest = async (args: CreateEpicArgs) => {
        try {
            const epic = await taskService.addTask({ ...args, item_type: 'epic' });
            return { content: [{ type: "text" as const, text: JSON.stringify(epic) }] };
        } catch (error: unknown) {
            logger.error(`[${TOOL_NAME}] Error processing request:`, error);
            if (error instanceof NotFoundError || error instanceof ValidationError) {
                throw new McpError(ErrorCode.InvalidParams, error.message);
            }
            throw new McpError(ErrorCode.InternalError, error instanceof Error ? error.message : 'An unknown error occurred while creating the epic.');
        }
    };

    server.tool(TOOL_NAME, TOOL_DESCRIPTION, TOOL_PARAMS.shape, processRequest);
    logger.info(`[${TOOL_NAME}] Tool registered successfully.`);
};
