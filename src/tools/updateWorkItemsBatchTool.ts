import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { TaskService } from "../services/TaskService.js";
import { NotFoundError, ValidationError } from "../utils/errors.js";
import { logger } from '../utils/logger.js';
import { TOOL_DESCRIPTION, TOOL_NAME, TOOL_PARAMS, UpdateWorkItemsBatchArgs } from "./updateWorkItemsBatchParams.js";

export const updateWorkItemsBatchTool = (server: McpServer, taskService: TaskService): void => {
    const processRequest = async (args: UpdateWorkItemsBatchArgs) => {
        try {
            const result = await taskService.updateWorkItemsBatch(args.project_id, args.updates, args.dry_run);
            return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
        } catch (error: unknown) {
            logger.error(`[${TOOL_NAME}] Error processing request:`, error);
            if (error instanceof NotFoundError || error instanceof ValidationError) {
                throw new McpError(ErrorCode.InvalidParams, error.message);
            }
            throw new McpError(ErrorCode.InternalError, error instanceof Error ? error.message : 'An unknown error occurred while updating work items.');
        }
    };

    server.tool(TOOL_NAME, TOOL_DESCRIPTION, TOOL_PARAMS.shape, processRequest);
    logger.info(`[${TOOL_NAME}] Tool registered successfully.`);
};
