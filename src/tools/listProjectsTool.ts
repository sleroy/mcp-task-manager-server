import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import {
  TOOL_NAME,
  TOOL_DESCRIPTION,
  TOOL_PARAMS,
  ListProjectsArgs,
} from "./listProjectsParams.js";
import { ProjectService } from "../services/ProjectService.js";
import { logger } from "../utils/logger.js";

/**
 * Registers the listProjects tool with the MCP server.
 *
 * @param server - The McpServer instance.
 * @param projectService - An instance of the ProjectService.
 */
export const listProjectsTool = (
  server: McpServer,
  projectService: ProjectService
): void => {
  const processRequest = async (args: ListProjectsArgs) => {
    logger.info(`[${TOOL_NAME}] Received request with args:`, args);
    try {
      const projects = await projectService.listProjects();
      logger.info(`[${TOOL_NAME}] Found ${projects.length} project(s).`);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(projects),
          },
        ],
      };
    } catch (error: unknown) {
      logger.error(`[${TOOL_NAME}] Error processing request:`, error);
      const message =
        error instanceof Error
          ? error.message
          : "An unknown error occurred while listing projects.";
      throw new McpError(ErrorCode.InternalError, message);
    }
  };

  server.tool(TOOL_NAME, TOOL_DESCRIPTION, TOOL_PARAMS, processRequest);

  logger.info(`[${TOOL_NAME}] Tool registered successfully.`);
};
