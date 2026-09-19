import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { ReportServerManager } from "../services/ReportServerManager.js";
import { logger } from "../utils/logger.js";
import {
  StartReportServerArgs,
  TOOL_NAME,
  TOOL_DESCRIPTION,
  TOOL_PARAMS,
} from "./startReportServerParams.js";

/**
 * Registers the startReportServer tool with the MCP server.
 *
 * @param server - The McpServer instance.
 * @param reportServerManager - Shared ReportServerManager instance.
 */
export const startReportServerTool = (
  server: McpServer,
  reportServerManager: ReportServerManager
): void => {
  const processRequest = async (args: StartReportServerArgs) => {
    logger.info(`[${TOOL_NAME}] Received request with args:`, args);
    try {
      const info = await reportServerManager.start(
        args.port ?? 0,
        args.host ?? "127.0.0.1"
      );
      const responsePayload = {
        url: info.url,
        host: info.host,
        port: info.port,
        already_running: info.already_running,
        message: info.already_running
          ? `Report server already running. Open ${info.url} in your browser.`
          : `Report server started. Open ${info.url} in your browser.`,
      };
      logger.info(`[${TOOL_NAME}] ${responsePayload.message}`);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(responsePayload),
          },
        ],
      };
    } catch (error: unknown) {
      logger.error(`[${TOOL_NAME}] Error processing request:`, error);
      const message =
        error instanceof Error
          ? error.message
          : "An unknown error occurred while starting the report server.";
      throw new McpError(ErrorCode.InternalError, message);
    }
  };

  server.tool(TOOL_NAME, TOOL_DESCRIPTION, TOOL_PARAMS, processRequest);
  logger.info(`[${TOOL_NAME}] Tool registered successfully.`);
};
