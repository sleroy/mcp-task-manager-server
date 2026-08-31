import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { DatabaseManager } from "../db/DatabaseManager.js";
import { logger } from "../utils/logger.js";
import {
  CheckpointDatabaseArgs,
  TOOL_DESCRIPTION,
  TOOL_NAME,
  TOOL_PARAMS,
} from "./checkpointDatabaseParams.js";

export const checkpointDatabaseTool = (
  server: McpServer,
  dbManager: DatabaseManager
): void => {
  const processRequest = async (_args: CheckpointDatabaseArgs) => {
    try {
      const result = dbManager.checkpointWal();
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    } catch (error: unknown) {
      logger.error(`[${TOOL_NAME}] Error processing request:`, error);
      throw new McpError(
        ErrorCode.InternalError,
        error instanceof Error
          ? error.message
          : "An unknown error occurred while checkpointing the database."
      );
    }
  };

  server.tool(TOOL_NAME, TOOL_DESCRIPTION, TOOL_PARAMS.shape, processRequest);
  logger.info(`[${TOOL_NAME}] Tool registered successfully.`);
};
