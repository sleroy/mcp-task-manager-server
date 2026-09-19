import { z } from "zod";

export const TOOL_NAME = "startReportServer";

export const TOOL_DESCRIPTION = `
Starts a local, read-only HTTP server that serves a navigable web report of all
projects. The report shows per-project progress and lets you browse the full
work-item hierarchy (epics, stories, tasks), sprints, and milestones from a
browser. The server binds to loopback (127.0.0.1) by default and stays running
for the lifetime of the MCP server process. Calling this tool again returns the
already-running server URL instead of starting a second instance.
Returns the URL to open in a browser.
`;

// Define the shape of the parameters for the server.tool method
export const TOOL_PARAMS = {
  port: z
    .number()
    .int("Port must be an integer.")
    .min(0, "Port must be between 0 and 65535.")
    .max(65535, "Port must be between 0 and 65535.")
    .optional()
    .describe(
      "Optional TCP port to bind. Use 0 (default) to pick a random free port."
    ),
  host: z
    .string()
    .min(1)
    .optional()
    .describe(
      "Optional host/interface to bind. Defaults to 127.0.0.1 (loopback). Use 0.0.0.0 to expose on the local network (not recommended)."
    ),
};

const toolParamsSchema = z.object(TOOL_PARAMS);

export type StartReportServerArgs = z.infer<typeof toolParamsSchema>;
