import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ConfigurationManager } from "../config/ConfigurationManager.js";
import { logger } from "../utils/index.js"; // Now using barrel file
import { DatabaseManager } from "../db/DatabaseManager.js";
import { ProjectRepository } from "../repositories/ProjectRepository.js";
import { TaskRepository } from "../repositories/TaskRepository.js"; // Added TaskRepository import
import { SprintRepository } from "../repositories/SprintRepository.js";
import { ProjectService, SprintService, TaskService } from "../services/index.js"; // Using barrel file, added TaskService

// Import tool registration functions
// import { exampleTool } from "./exampleTool.js"; // Commenting out example
import { createProjectTool } from "./createProjectTool.js";
import { addTaskTool } from "./addTaskTool.js";
import { listTasksTool } from "./listTasksTool.js";
import { showTaskTool } from "./showTaskTool.js";
import { setTaskStatusTool } from "./setTaskStatusTool.js";
import { expandTaskTool } from "./expandTaskTool.js";
import { getNextTaskTool } from "./getNextTaskTool.js";
import { exportProjectTool } from "./exportProjectTool.js";
import { importProjectTool } from "./importProjectTool.js";
import { updateTaskTool } from "./updateTaskTool.js"; // Import the new tool
import { deleteTaskTool } from "./deleteTaskTool.js"; // Import deleteTask tool
import { deleteProjectTool } from "./deleteProjectTool.js"; // Import deleteProject tool
import { closeTaskTool } from "./closeTaskTool.js";
import { closeSprintTool } from "./closeSprintTool.js";
import { createEpicTool } from "./createEpicTool.js";
import { createSprintTool } from "./createSprintTool.js";
import { createStoryTool } from "./createStoryTool.js";
import { assignToSprintTool } from "./assignToSprintTool.js";
import { getEpicProgressTool } from "./getEpicProgressTool.js";
import { getSprintBacklogTool } from "./getSprintBacklogTool.js";
import { getSprintProgressTool } from "./getSprintProgressTool.js";
import { listEpicsTool } from "./listEpicsTool.js";
import { listStoriesTool } from "./listStoriesTool.js";
import { listSprintsTool } from "./listSprintsTool.js";
import { startSprintTool } from "./startSprintTool.js";
import { updateSprintTool } from "./updateSprintTool.js";
// import { yourTool } from "./yourTool.js"; // Add other new tool imports here

/**
 * Register all defined tools with the MCP server instance.
 * This function centralizes tool registration logic.
 * It also instantiates necessary services and repositories.
 */
export function registerTools(server: McpServer): void {
    logger.info("Registering tools...");
    const configManager = ConfigurationManager.getInstance();

    // --- Instantiate Dependencies ---
    // Note: Consider dependency injection frameworks for larger applications
    try {
        const dbManager = DatabaseManager.getInstance();
        const db = dbManager.getDb(); // Get the initialized DB connection

        // Instantiate Repositories
        const projectRepository = new ProjectRepository(db);
        const taskRepository = new TaskRepository(db); // Instantiate TaskRepository
        const sprintRepository = new SprintRepository(db);

        // Instantiate Services
        const projectService = new ProjectService(db, projectRepository, taskRepository, sprintRepository); // Pass db and repos
        const sprintService = new SprintService(sprintRepository, projectRepository);
        const taskService = new TaskService(db, taskRepository, projectRepository, sprintRepository); // Instantiate TaskService, passing db and repos

        // --- Register Tools ---
        // Register each tool, passing necessary services

        // exampleTool(server, configManager.getExampleServiceConfig()); // Example commented out

        createProjectTool(server, projectService);
        createSprintTool(server, sprintService);
        listSprintsTool(server, sprintService);
        updateSprintTool(server, sprintService);
        startSprintTool(server, sprintService);
        closeSprintTool(server, taskService);
        getSprintProgressTool(server, taskService);
        getSprintBacklogTool(server, taskService);
        assignToSprintTool(server, taskService);
        createEpicTool(server, taskService);
        listEpicsTool(server, taskService);
        createStoryTool(server, taskService);
        listStoriesTool(server, taskService);
        getEpicProgressTool(server, taskService);
        addTaskTool(server, taskService);
        listTasksTool(server, taskService);
        showTaskTool(server, taskService);
        setTaskStatusTool(server, taskService);
        closeTaskTool(server, taskService);
        expandTaskTool(server, taskService);
        getNextTaskTool(server, taskService);
        exportProjectTool(server, projectService);
        importProjectTool(server, projectService); // Register importProjectTool (uses ProjectService)
        updateTaskTool(server, taskService); // Register the new updateTask tool
        deleteTaskTool(server, taskService); // Register deleteTask tool
        deleteProjectTool(server, projectService); // Register deleteProject tool (uses ProjectService)
        // ... etc.

        logger.info("All tools registered successfully.");

    } catch (error) {
        logger.error("Failed to instantiate dependencies or register tools:", error);
        // Depending on the desired behavior, you might want to exit the process
        // process.exit(1);
        throw new Error("Failed to initialize server components during tool registration.");
    }
}
