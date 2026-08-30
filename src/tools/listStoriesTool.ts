import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { TaskService } from "../services/TaskService.js";
import { NotFoundError } from "../utils/errors.js";
import { logger } from '../utils/logger.js';
import { ListStoriesArgs, TOOL_DESCRIPTION, TOOL_NAME, TOOL_PARAMS } from "./listStoriesParams.js";

export const listStoriesTool = (server: McpServer, taskService: TaskService): void => {
    const processRequest = async (args: ListStoriesArgs) => {
        try {
            const stories = await taskService.listStories({
                project_id: args.project_id,
                status: args.status,
                epic_id: args.epic_id,
                sprint_id: args.sprint_id,
                milestone: args.milestone,
                include_subtasks: args.include_subtasks,
            });
            return { content: [{ type: "text" as const, text: JSON.stringify(stories) }] };
        } catch (error: unknown) {
            logger.error(`[${TOOL_NAME}] Error processing request:`, error);
            if (error instanceof NotFoundError) {
                throw new McpError(ErrorCode.InvalidParams, error.message);
            }
            throw new McpError(ErrorCode.InternalError, error instanceof Error ? error.message : 'An unknown error occurred while listing stories.');
        }
    };

    server.tool(TOOL_NAME, TOOL_DESCRIPTION, TOOL_PARAMS.shape, processRequest);
    logger.info(`[${TOOL_NAME}] Tool registered successfully.`);
};
