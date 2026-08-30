import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { SprintService } from "../services/SprintService.js";
import { NotFoundError } from "../utils/errors.js";
import { logger } from '../utils/logger.js';
import { ListSprintsArgs, TOOL_DESCRIPTION, TOOL_NAME, TOOL_PARAMS } from "./listSprintsParams.js";

export const listSprintsTool = (server: McpServer, sprintService: SprintService): void => {
    const processRequest = async (args: ListSprintsArgs) => {
        try {
            const sprints = await sprintService.listSprints(args);
            return { content: [{ type: "text" as const, text: JSON.stringify(sprints) }] };
        } catch (error: unknown) {
            logger.error(`[${TOOL_NAME}] Error processing request:`, error);
            if (error instanceof NotFoundError) {
                throw new McpError(ErrorCode.InvalidParams, error.message);
            }
            throw new McpError(ErrorCode.InternalError, error instanceof Error ? error.message : 'An unknown error occurred while listing sprints.');
        }
    };

    server.tool(TOOL_NAME, TOOL_DESCRIPTION, TOOL_PARAMS.shape, processRequest);
    logger.info(`[${TOOL_NAME}] Tool registered successfully.`);
};
