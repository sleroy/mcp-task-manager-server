import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { TaskService } from "../services/TaskService.js";
import { NotFoundError, ValidationError } from "../utils/errors.js";
import { logger } from '../utils/logger.js';
import { CreateStoryArgs, TOOL_DESCRIPTION, TOOL_NAME, TOOL_PARAMS } from "./createStoryParams.js";

export const createStoryTool = (server: McpServer, taskService: TaskService): void => {
    const processRequest = async (args: CreateStoryArgs) => {
        try {
            const story = await taskService.addTask({
                project_id: args.project_id,
                parent_task_id: args.epic_id,
                sprint_id: args.sprint_id,
                milestone: args.milestone,
                description: args.description,
                priority: args.priority,
                status: args.status,
                item_type: 'story',
            });
            return { content: [{ type: "text" as const, text: JSON.stringify(story) }] };
        } catch (error: unknown) {
            logger.error(`[${TOOL_NAME}] Error processing request:`, error);
            if (error instanceof NotFoundError || error instanceof ValidationError) {
                throw new McpError(ErrorCode.InvalidParams, error.message);
            }
            throw new McpError(ErrorCode.InternalError, error instanceof Error ? error.message : 'An unknown error occurred while creating the story.');
        }
    };

    server.tool(TOOL_NAME, TOOL_DESCRIPTION, TOOL_PARAMS.shape, processRequest);
    logger.info(`[${TOOL_NAME}] Tool registered successfully.`);
};
