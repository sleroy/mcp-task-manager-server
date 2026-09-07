import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { ProjectService } from "../services/ProjectService.js";
import { logger } from "../utils/logger.js";
import { TOOL_NAME, TOOL_DESCRIPTION, TOOL_PARAMS, SearchProjectsArgs } from "./searchProjectsParams.js";

/** Registers the project discovery/search tool with the MCP server. */
export const searchProjectsTool = (server: McpServer, projectService: ProjectService): void => {
    const processRequest = async (args: SearchProjectsArgs) => {
        logger.info(`[${TOOL_NAME}] Received request with query '${args.query || 'all'}'.`);
        try {
            const projects = await projectService.searchProjects(args.query, args.limit);
            return {
                content: [{
                    type: "text" as const,
                    text: JSON.stringify(projects),
                }],
            };
        } catch (error: unknown) {
            logger.error(`[${TOOL_NAME}] Error processing request:`, error);
            const message = error instanceof Error ? error.message : 'An unknown error occurred while searching projects.';
            throw new McpError(ErrorCode.InternalError, message);
        }
    };

    server.tool(TOOL_NAME, TOOL_DESCRIPTION, TOOL_PARAMS.shape, processRequest);
    logger.info(`[${TOOL_NAME}] Tool registered successfully.`);
};
