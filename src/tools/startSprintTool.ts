import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { SprintService } from "../services/SprintService.js";
import { NotFoundError } from "../utils/errors.js";
import { logger } from '../utils/logger.js';
import { StartSprintArgs, TOOL_DESCRIPTION, TOOL_NAME, TOOL_PARAMS } from "./startSprintParams.js";

export const startSprintTool = (server: McpServer, sprintService: SprintService): void => {
    const processRequest = async (args: StartSprintArgs) => {
        try {
            const result = await sprintService.startSprint(args.project_id, args.sprint_id, args.make_exclusive);
            return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
        } catch (error: unknown) {
            logger.error(`[${TOOL_NAME}] Error processing request:`, error);
            if (error instanceof NotFoundError) {
                throw new McpError(ErrorCode.InvalidParams, error.message);
            }
            throw new McpError(ErrorCode.InternalError, error instanceof Error ? error.message : 'An unknown error occurred while starting the sprint.');
        }
    };

    server.tool(TOOL_NAME, TOOL_DESCRIPTION, TOOL_PARAMS.shape, processRequest);
    logger.info(`[${TOOL_NAME}] Tool registered successfully.`);
};
