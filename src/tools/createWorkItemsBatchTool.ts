import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { TaskService } from "../services/TaskService.js";
import { NotFoundError, ValidationError } from "../utils/errors.js";
import { logger } from '../utils/logger.js';
import { CreateWorkItemsBatchArgs, TOOL_DESCRIPTION, TOOL_NAME, TOOL_PARAMS } from "./createWorkItemsBatchParams.js";

export const createWorkItemsBatchTool = (server: McpServer, taskService: TaskService): void => {
    const processRequest = async (args: CreateWorkItemsBatchArgs) => {
        try {
            const result = await taskService.createWorkItemsBatch(
                args.project_id,
                args.items.map(item => ({ ...item, project_id: args.project_id })),
                args.dry_run
            );
            return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
        } catch (error: unknown) {
            logger.error(`[${TOOL_NAME}] Error processing request:`, error);
            if (error instanceof NotFoundError || error instanceof ValidationError) {
                throw new McpError(ErrorCode.InvalidParams, error.message);
            }
            throw new McpError(ErrorCode.InternalError, error instanceof Error ? error.message : 'An unknown error occurred while creating work items.');
        }
    };

    server.tool(TOOL_NAME, TOOL_DESCRIPTION, TOOL_PARAMS.shape, processRequest);
    logger.info(`[${TOOL_NAME}] Tool registered successfully.`);
};
