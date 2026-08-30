import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { ProjectService } from "../services/ProjectService.js";
import { NotFoundError, ValidationError } from "../utils/errors.js";
import { logger } from '../utils/logger.js';
import { ExportProjectSnapshotArgs, TOOL_DESCRIPTION, TOOL_NAME, TOOL_PARAMS } from "./exportProjectSnapshotParams.js";

export const exportProjectSnapshotTool = (server: McpServer, projectService: ProjectService): void => {
    const processRequest = async (args: ExportProjectSnapshotArgs) => {
        try {
            const result = await projectService.exportProjectSnapshot(args.project_id, args.output_path);
            return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
        } catch (error: unknown) {
            logger.error(`[${TOOL_NAME}] Error processing request:`, error);
            if (error instanceof NotFoundError || error instanceof ValidationError) {
                throw new McpError(ErrorCode.InvalidParams, error.message);
            }
            throw new McpError(ErrorCode.InternalError, error instanceof Error ? error.message : 'An unknown error occurred while exporting the project snapshot.');
        }
    };

    server.tool(TOOL_NAME, TOOL_DESCRIPTION, TOOL_PARAMS.shape, processRequest);
    logger.info(`[${TOOL_NAME}] Tool registered successfully.`);
};
