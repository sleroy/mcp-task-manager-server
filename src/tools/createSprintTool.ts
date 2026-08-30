import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { SprintService } from "../services/SprintService.js";
import { NotFoundError, ValidationError } from "../utils/errors.js";
import { logger } from '../utils/logger.js';
import { CreateSprintArgs, TOOL_DESCRIPTION, TOOL_NAME, TOOL_PARAMS } from "./createSprintParams.js";

export const createSprintTool = (server: McpServer, sprintService: SprintService): void => {
    const processRequest = async (args: CreateSprintArgs) => {
        try {
            const sprint = await sprintService.createSprint(args);
            return { content: [{ type: "text" as const, text: JSON.stringify(sprint) }] };
        } catch (error: unknown) {
            logger.error(`[${TOOL_NAME}] Error processing request:`, error);
            if (error instanceof NotFoundError || error instanceof ValidationError) {
                throw new McpError(ErrorCode.InvalidParams, error.message);
            }
            throw new McpError(ErrorCode.InternalError, error instanceof Error ? error.message : 'An unknown error occurred while creating the sprint.');
        }
    };

    server.tool(TOOL_NAME, TOOL_DESCRIPTION, TOOL_PARAMS.shape, processRequest);
    logger.info(`[${TOOL_NAME}] Tool registered successfully.`);
};
