import { z } from 'zod';

export const TOOL_NAME = "exportProjectSnapshot";

export const TOOL_DESCRIPTION = `
Exports complete project data as formatted JSON and writes it directly to a local file.
`;

export const TOOL_PARAMS = z.object({
    project_id: z.string().uuid("The project_id must be a valid UUID.")
        .describe("The unique identifier (UUID) of the project to export."),
    output_path: z.string().min(1)
        .describe("Absolute path where the JSON snapshot should be written."),
});

export type ExportProjectSnapshotArgs = z.infer<typeof TOOL_PARAMS>;
