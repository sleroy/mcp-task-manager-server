import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { SprintService } from "../services/SprintService.js";
import { NotFoundError, ValidationError } from "../utils/errors.js";
import { logger } from '../utils/logger.js';
import { TOOL_DESCRIPTION, TOOL_NAME, UPDATE_SPRINT_BASE_SCHEMA, UpdateSprintArgs } from "./updateSprintParams.js";

export const updateSprintTool = (server: McpServer, sprintService: SprintService): void => {
    const processRequest = async (args: UpdateSprintArgs) => {
        try {
            const sprint = await sprintService.updateSprint(args);
            return { content: [{ type: "text" as const, text: JSON.stringify(sprint) }] };
        } catch (error: unknown) {
            logger.error(`[${TOOL_NAME}] Error processing request:`, error);
            if (error instanceof NotFoundError || error instanceof ValidationError) {
                throw new McpError(ErrorCode.InvalidParams, error.message);
            }
            throw new McpError(ErrorCode.InternalError, error instanceof Error ? error.message : 'An unknown error occurred while updating the sprint.');
        }
    };

    server.tool(TOOL_NAME, TOOL_DESCRIPTION, UPDATE_SPRINT_BASE_SCHEMA.shape, processRequest);
    logger.info(`[${TOOL_NAME}] Tool registered successfully.`);
};
