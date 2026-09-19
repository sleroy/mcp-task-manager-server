import { Database as Db } from "better-sqlite3";
import { v4 as uuidv4 } from "uuid";
import { ProjectRepository } from "../repositories/ProjectRepository.js";
import { SprintRepository } from "../repositories/SprintRepository.js";
import {
  DependencyData,
  TaskRepository,
  TaskData,
} from "../repositories/TaskRepository.js";
import { TaskPriority, TaskStatus, WorkItemType } from "../types/taskTypes.js";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../utils/errors.js";

export interface AddTaskInput {
  project_id: string;
  description: string;
  item_type?: WorkItemType;
  parent_task_id?: string | null;
  sprint_id?: string | null;
  milestone?: string | null;
  dependencies?: string[];
  priority?: TaskPriority;
  status?: TaskStatus;
}

export interface ListTasksOptions {
  project_id: string;
  status?: TaskStatus;
  item_type?: WorkItemType;
  sprint_id?: string | null;
  parent_task_id?: string | null;
  milestone?: string | null;
  include_subtasks?: boolean;
}

export interface StructuredTaskData extends TaskData {
  subtasks?: StructuredTaskData[];
}

export interface FullTaskData extends TaskData {
  dependencies: string[];
  subtasks: TaskData[];
}

export type TaskComplexity = "low" | "medium" | "high";

export interface NextTaskCandidate {
  task: FullTaskData;
  score: number;
  complexity: TaskComplexity;
  dependency_depth: number;
  unblocks_count: number;
  unblocks: string[];
  reasons: string[];
}

export interface NextTaskSelection {
  selected_sprint_id: string | null;
  candidates: NextTaskCandidate[];
  blocked_summary: {
    blocked_count: number;
    cycle_count: number;
    cycles: string[][];
  };
}

export interface NextTaskSelectionOptions {
  limit?: number;
  max_complexity?: TaskComplexity;
}

export interface ExpandTaskInput {
  project_id: string;
  task_id: string;
  subtask_descriptions: string[];
  force?: boolean;
}

export interface SprintProgress {
  sprint_id: string;
  project_id: string;
  total_items: number;
  total_tasks: number;
  done_tasks: number;
  open_tasks: number;
  progress_percent: number;
  by_status: Record<TaskStatus, number>;
}

export interface EpicProgress {
  epic_id: string;
  project_id: string;
  total_items: number;
  total_stories: number;
  total_tasks: number;
  done_tasks: number;
  open_tasks: number;
  progress_percent: number;
  by_status: Record<TaskStatus, number>;
}

export interface BatchCreateWorkItemInput extends AddTaskInput {
  client_id?: string;
  parent_client_id?: string;
  dependency_client_ids?: string[];
}

export interface BatchCreateWorkItemsResult {
  dry_run: boolean;
  created_count: number;
  id_map: Record<string, string>;
  items: TaskData[];
}

export interface BatchUpdateWorkItemInput {
  task_id: string;
  description?: string;
  priority?: TaskPriority;
  parent_task_id?: string | null;
  sprint_id?: string | null;
  milestone?: string | null;
  dependencies?: string[];
}

export interface BatchUpdateWorkItemsResult {
  dry_run: boolean;
  updated_count: number;
  task_ids: string[];
}

export interface BatchCloseWorkItemsResult {
  dry_run: boolean;
  closed_count: number;
  task_ids: string[];
}

export interface BacklogImportNode {
  client_id?: string;
  description: string;
  priority?: TaskPriority;
  status?: TaskStatus;
  sprint_id?: string | null;
  milestone?: string | null;
  stories?: BacklogImportNode[];
  tasks?: BacklogImportNode[];
}

export interface AssignToSprintInput {
  project_id: string;
  sprint_id: string | null;
  task_ids?: string[];
  item_type?: WorkItemType;
  status?: TaskStatus;
  parent_task_id?: string | null;
  epic_id?: string;
  milestone?: string | null;
  include_subtasks?: boolean;
}

const TERMINAL_TASK_STATUSES = new Set<TaskStatus>(["done", "cancelled"]);

export class TaskService {
  constructor(
    private db: Db,
    private taskRepository: TaskRepository,
    private projectRepository: ProjectRepository,
    private sprintRepository: SprintRepository
  ) {}

  public async addTask(input: AddTaskInput): Promise<TaskData> {
    this.ensureProjectExists(input.project_id);

    const itemType = input.item_type ?? "task";
    const parentTaskId = input.parent_task_id ?? null;
    const sprintId = input.sprint_id ?? null;
    const milestone = input.milestone ?? null;
    this.validateWorkItemPlacement(
      input.project_id,
      itemType,
      parentTaskId,
      sprintId
    );

    const taskId = uuidv4();
    this.validateDependencies(input.project_id, taskId, input.dependencies);

    const now = new Date().toISOString();
    const newTaskData: TaskData = {
      task_id: taskId,
      project_id: input.project_id,
      parent_task_id: parentTaskId,
      sprint_id: sprintId,
      milestone,
      item_type: itemType,
      description: input.description,
      status: input.status ?? "todo",
      priority: input.priority ?? "medium",
      created_at: now,
      updated_at: now,
    };

    this.taskRepository.create(newTaskData, input.dependencies ?? []);
    return newTaskData;
  }

  public async createWorkItemsBatch(
    projectId: string,
    items: BatchCreateWorkItemInput[],
    dryRun = false
  ): Promise<BatchCreateWorkItemsResult> {
    this.ensureProjectExists(projectId);
    const { resolvedItems, idMap } = this.prepareBatchCreates(projectId, items);

    if (!dryRun) {
      const transaction = this.db.transaction(() => {
        for (const item of resolvedItems) {
          this.taskRepository.create(item.task, []);
        }
        const insertDependencyStmt = this.db.prepare(`
                    INSERT INTO task_dependencies (task_id, depends_on_task_id)
                    VALUES (?, ?)
                    ON CONFLICT(task_id, depends_on_task_id) DO NOTHING
                `);
        for (const item of resolvedItems) {
          for (const dependency of item.dependencies) {
            insertDependencyStmt.run(item.task.task_id, dependency);
          }
        }
      });
      transaction();
    }

    return {
      dry_run: dryRun,
      created_count: resolvedItems.length,
      id_map: Object.fromEntries(idMap),
      items: resolvedItems.map((item) => item.task),
    };
  }

  public async updateWorkItemsBatch(
    projectId: string,
    updates: BatchUpdateWorkItemInput[],
    dryRun = false
  ): Promise<BatchUpdateWorkItemsResult> {
    this.ensureProjectExists(projectId);
    this.ensureTasksExist(
      projectId,
      updates.map((update) => update.task_id)
    );

    for (const update of updates) {
      const existingTask = this.taskRepository.findById(
        projectId,
        update.task_id
      );
      if (!existingTask) {
        throw new NotFoundError(
          `Task with ID ${update.task_id} not found in project ${projectId}.`
        );
      }
      this.validateWorkItemPlacement(
        projectId,
        existingTask.item_type,
        update.parent_task_id !== undefined
          ? update.parent_task_id
          : (existingTask.parent_task_id ?? null),
        update.sprint_id !== undefined
          ? update.sprint_id
          : (existingTask.sprint_id ?? null),
        update.task_id
      );
      this.validateDependencies(projectId, update.task_id, update.dependencies);
    }

    if (!dryRun) {
      const transaction = this.db.transaction(() => {
        for (const update of updates) {
          this.taskRepository.updateTask(
            projectId,
            update.task_id,
            {
              description: update.description,
              priority: update.priority,
              parent_task_id: update.parent_task_id,
              sprint_id: update.sprint_id,
              milestone: update.milestone,
              dependencies: update.dependencies,
            },
            new Date().toISOString()
          );
        }
      });
      transaction();
    }

    return {
      dry_run: dryRun,
      updated_count: updates.length,
      task_ids: updates.map((update) => update.task_id),
    };
  }

  public async closeWorkItemsBatch(
    projectId: string,
    taskIds: string[],
    includeSubtasks = true,
    dryRun = false
  ): Promise<BatchCloseWorkItemsResult> {
    this.ensureProjectExists(projectId);
    this.ensureTasksExist(projectId, taskIds);

    const taskIdsToClose = new Set<string>();
    for (const taskId of taskIds) {
      taskIdsToClose.add(taskId);
      if (includeSubtasks) {
        for (const descendant of this.taskRepository.findDescendants(
          projectId,
          taskId
        )) {
          taskIdsToClose.add(descendant.task_id);
        }
      }
    }

    if (!dryRun) {
      this.taskRepository.updateStatus(
        projectId,
        [...taskIdsToClose],
        "done",
        new Date().toISOString()
      );
    }

    return {
      dry_run: dryRun,
      closed_count: taskIdsToClose.size,
      task_ids: [...taskIdsToClose],
    };
  }

  public async importBacklog(
    projectId: string,
    epics: BacklogImportNode[],
    sprintId?: string | null,
    dryRun = false
  ): Promise<BatchCreateWorkItemsResult> {
    const items: BatchCreateWorkItemInput[] = [];
    let generatedClientId = 0;
    const nextClientId = () => `import-${++generatedClientId}`;

    for (const epic of epics) {
      const epicClientId = epic.client_id ?? nextClientId();
      items.push({
        project_id: projectId,
        client_id: epicClientId,
        item_type: "epic",
        description: epic.description,
        priority: epic.priority,
        status: epic.status,
        milestone: epic.milestone ?? null,
      });

      for (const story of epic.stories ?? []) {
        const storyClientId = story.client_id ?? nextClientId();
        const storyMilestone = story.milestone ?? epic.milestone ?? null;
        items.push({
          project_id: projectId,
          client_id: storyClientId,
          parent_client_id: epicClientId,
          sprint_id: story.sprint_id ?? sprintId ?? null,
          milestone: storyMilestone,
          item_type: "story",
          description: story.description,
          priority: story.priority,
          status: story.status,
        });

        for (const task of story.tasks ?? []) {
          items.push({
            project_id: projectId,
            client_id: task.client_id ?? nextClientId(),
            parent_client_id: storyClientId,
            sprint_id: task.sprint_id ?? story.sprint_id ?? sprintId ?? null,
            milestone: task.milestone ?? storyMilestone,
            item_type: "task",
            description: task.description,
            priority: task.priority,
            status: task.status,
          });
        }
      }

      for (const task of epic.tasks ?? []) {
        items.push({
          project_id: projectId,
          client_id: task.client_id ?? nextClientId(),
          parent_client_id: epicClientId,
          sprint_id: task.sprint_id ?? sprintId ?? null,
          milestone: task.milestone ?? epic.milestone ?? null,
          item_type: "task",
          description: task.description,
          priority: task.priority,
          status: task.status,
        });
      }
    }

    return this.createWorkItemsBatch(projectId, items, dryRun);
  }

  public async listTasks(
    options: ListTasksOptions
  ): Promise<TaskData[] | StructuredTaskData[]> {
    this.ensureProjectExists(options.project_id);

    const allTasks = this.taskRepository.findByProjectId(options.project_id, {
      status: options.status,
      item_type: options.item_type,
      sprint_id: options.sprint_id,
      parent_task_id: options.parent_task_id,
      milestone: options.milestone,
    });

    if (!options.include_subtasks) {
      return options.parent_task_id === undefined
        ? allTasks.filter((task) => !task.parent_task_id)
        : allTasks;
    }

    return this.structureTasks(allTasks, options.parent_task_id !== undefined);
  }

  public async listEpics(
    projectId: string,
    status?: TaskStatus,
    includeSubtasks = true,
    milestone?: string | null
  ): Promise<TaskData[] | StructuredTaskData[]> {
    this.ensureProjectExists(projectId);
    const allTasks = this.taskRepository.findAllTasksForProject(projectId);
    const epicIds = new Set(
      allTasks
        .filter(
          (task) =>
            task.item_type === "epic" &&
            (status === undefined || task.status === status) &&
            (milestone === undefined || task.milestone === milestone)
        )
        .map((task) => task.task_id)
    );

    if (!includeSubtasks) {
      return allTasks.filter((task) => epicIds.has(task.task_id));
    }

    const requiredIds = new Set(epicIds);
    for (const epicId of epicIds) {
      for (const descendant of this.taskRepository.findDescendants(
        projectId,
        epicId
      )) {
        requiredIds.add(descendant.task_id);
      }
    }

    return this.structureTasks(
      allTasks.filter((task) => requiredIds.has(task.task_id)),
      false
    );
  }

  public async listStories(options: {
    project_id: string;
    epic_id?: string;
    sprint_id?: string;
    milestone?: string | null;
    status?: TaskStatus;
    include_subtasks?: boolean;
  }): Promise<TaskData[] | StructuredTaskData[]> {
    this.ensureProjectExists(options.project_id);
    const allTasks = this.taskRepository.findAllTasksForProject(
      options.project_id
    );
    const stories = allTasks.filter(
      (task) =>
        task.item_type === "story" &&
        (options.status === undefined || task.status === options.status) &&
        (options.epic_id === undefined ||
          task.parent_task_id === options.epic_id) &&
        (options.sprint_id === undefined ||
          task.sprint_id === options.sprint_id) &&
        (options.milestone === undefined ||
          task.milestone === options.milestone)
    );

    if (!options.include_subtasks) {
      return stories;
    }

    const requiredIds = new Set(stories.map((story) => story.task_id));
    for (const story of stories) {
      for (const descendant of this.taskRepository.findDescendants(
        options.project_id,
        story.task_id
      )) {
        requiredIds.add(descendant.task_id);
      }
    }

    return this.structureTasks(
      allTasks.filter((task) => requiredIds.has(task.task_id)),
      true
    );
  }

  public async getTaskById(
    projectId: string,
    taskId: string
  ): Promise<FullTaskData> {
    const task = this.taskRepository.findById(projectId, taskId);
    if (!task) {
      throw new NotFoundError(
        `Task with ID ${taskId} not found in project ${projectId}.`
      );
    }

    return {
      ...task,
      dependencies: this.taskRepository.findDependencies(taskId),
      subtasks: this.taskRepository.findSubtasks(taskId),
    };
  }

  public async setTaskStatus(
    projectId: string,
    taskIds: string[],
    status: TaskStatus
  ): Promise<number> {
    this.ensureProjectExists(projectId);
    this.ensureTasksExist(projectId, taskIds);
    return this.taskRepository.updateStatus(
      projectId,
      taskIds,
      status,
      new Date().toISOString()
    );
  }

  public async closeTask(
    projectId: string,
    taskId: string,
    includeSubtasks = true
  ): Promise<{ closed_count: number; task_ids: string[] }> {
    this.ensureProjectExists(projectId);
    this.ensureTasksExist(projectId, [taskId]);

    const taskIds = includeSubtasks
      ? [
          taskId,
          ...this.taskRepository
            .findDescendants(projectId, taskId)
            .map((task) => task.task_id),
        ]
      : [taskId];
    const closedCount = this.taskRepository.updateStatus(
      projectId,
      taskIds,
      "done",
      new Date().toISOString()
    );
    return { closed_count: closedCount, task_ids: taskIds };
  }

  public async expandTask(input: ExpandTaskInput): Promise<FullTaskData> {
    this.ensureProjectExists(input.project_id);

    const expandTransaction = this.db.transaction(() => {
      const parentTask = this.taskRepository.findById(
        input.project_id,
        input.task_id
      );
      if (!parentTask) {
        throw new NotFoundError(
          `Parent task with ID ${input.task_id} not found in project ${input.project_id}.`
        );
      }

      const existingSubtasks = this.taskRepository.findSubtasks(input.task_id);
      if (existingSubtasks.length > 0 && !input.force) {
        throw new ConflictError(
          `Task ${input.task_id} already has subtasks. Use force=true to replace them.`
        );
      }
      if (existingSubtasks.length > 0) {
        this.taskRepository.deleteSubtasks(input.task_id);
      }

      const now = new Date().toISOString();
      const createdSubtasks = input.subtask_descriptions.map((description) => {
        const subtask: TaskData = {
          task_id: uuidv4(),
          project_id: input.project_id,
          parent_task_id: input.task_id,
          sprint_id: parentTask.sprint_id ?? null,
          milestone: parentTask.milestone ?? null,
          item_type: "task",
          description,
          status: "todo",
          priority: "medium",
          created_at: now,
          updated_at: now,
        };
        this.taskRepository.create(subtask, []);
        return subtask;
      });

      return {
        ...parentTask,
        dependencies: this.taskRepository.findDependencies(input.task_id),
        subtasks: createdSubtasks,
      };
    });

    return expandTransaction();
  }

  public async getNextTask(
    projectId: string,
    sprintId?: string
  ): Promise<FullTaskData | null> {
    const selection = await this.getNextTaskCandidates(projectId, sprintId, {
      limit: 1,
    });
    return selection.candidates[0]?.task ?? null;
  }

  public async getNextTaskCandidates(
    projectId: string,
    sprintId?: string,
    options: NextTaskSelectionOptions = {}
  ): Promise<NextTaskSelection> {
    this.ensureProjectExists(projectId);
    let selectedSprintId = sprintId;

    if (!selectedSprintId) {
      selectedSprintId =
        this.sprintRepository.findMostRecentActive(projectId)?.sprint_id;
    } else if (!this.sprintRepository.findById(projectId, selectedSprintId)) {
      throw new NotFoundError(
        `Sprint with ID ${selectedSprintId} not found in project ${projectId}.`
      );
    }

    const allTasks = this.taskRepository.findAllTasksForProject(projectId);
    const dependencies =
      this.taskRepository.findAllDependenciesForProject(projectId);
    const allTasksById = new Map(allTasks.map((task) => [task.task_id, task]));
    const dependencyMap = this.buildDependencyMap(dependencies);
    const dependentMap = this.buildDependentMap(dependencies);
    const cycles = this.findDependencyCycles(allTasks, dependencyMap);
    const cycleTaskIds = new Set(cycles.flat());
    const limit = Math.max(1, Math.min(options.limit ?? 3, 10));
    const maxComplexity = options.max_complexity;

    const blockedTasks = allTasks.filter(
      (task) =>
        task.item_type === "task" &&
        task.status === "todo" &&
        this.isTaskInNextTaskScope(task, selectedSprintId) &&
        (!this.areDependenciesTerminal(task, dependencyMap, allTasksById) ||
          cycleTaskIds.has(task.task_id))
    );

    const candidates = allTasks
      .filter(
        (task) =>
          task.item_type === "task" &&
          task.status === "todo" &&
          this.isTaskInNextTaskScope(task, selectedSprintId) &&
          !cycleTaskIds.has(task.task_id) &&
          this.areDependenciesTerminal(task, dependencyMap, allTasksById)
      )
      .map((task) =>
        this.toNextTaskCandidate(
          projectId,
          task,
          dependencyMap,
          dependentMap,
          allTasksById
        )
      )
      .filter(
        (candidate) =>
          maxComplexity === undefined ||
          this.complexityRank(candidate.complexity) <=
            this.complexityRank(maxComplexity)
      )
      .sort((a, b) => this.compareNextTaskCandidates(a, b))
      .slice(0, limit);

    return {
      selected_sprint_id: selectedSprintId ?? null,
      candidates,
      blocked_summary: {
        blocked_count: blockedTasks.length,
        cycle_count: cycles.length,
        cycles,
      },
    };
  }

  public async updateTask(input: {
    project_id: string;
    task_id: string;
    description?: string;
    priority?: TaskPriority;
    parent_task_id?: string | null;
    sprint_id?: string | null;
    milestone?: string | null;
    dependencies?: string[];
  }): Promise<FullTaskData> {
    if (
      input.description === undefined &&
      input.priority === undefined &&
      input.parent_task_id === undefined &&
      input.sprint_id === undefined &&
      input.milestone === undefined &&
      input.dependencies === undefined
    ) {
      throw new ValidationError(
        "At least one field (description, priority, parent_task_id, sprint_id, milestone, or dependencies) must be provided for update."
      );
    }

    this.ensureProjectExists(input.project_id);
    const existingTask = this.taskRepository.findById(
      input.project_id,
      input.task_id
    );
    if (!existingTask) {
      throw new NotFoundError(
        `Task with ID ${input.task_id} not found in project ${input.project_id}.`
      );
    }

    this.validateWorkItemPlacement(
      input.project_id,
      existingTask.item_type,
      input.parent_task_id !== undefined
        ? input.parent_task_id
        : (existingTask.parent_task_id ?? null),
      input.sprint_id !== undefined
        ? input.sprint_id
        : (existingTask.sprint_id ?? null),
      input.task_id
    );
    this.validateDependencies(
      input.project_id,
      input.task_id,
      input.dependencies
    );

    const updatedTaskData = this.taskRepository.updateTask(
      input.project_id,
      input.task_id,
      {
        description: input.description,
        priority: input.priority,
        parent_task_id: input.parent_task_id,
        sprint_id: input.sprint_id,
        milestone: input.milestone,
        dependencies: input.dependencies,
      },
      new Date().toISOString()
    );

    return {
      ...updatedTaskData,
      dependencies: this.taskRepository.findDependencies(input.task_id),
      subtasks: this.taskRepository.findSubtasks(input.task_id),
    };
  }

  public async deleteTasks(
    projectId: string,
    taskIds: string[]
  ): Promise<number> {
    this.ensureProjectExists(projectId);
    this.ensureTasksExist(projectId, taskIds);
    return this.taskRepository.deleteTasks(projectId, taskIds);
  }

  public async closeSprint(
    projectId: string,
    sprintId: string,
    closeTasks = true
  ): Promise<{ sprint_id: string; closed_task_count: number }> {
    this.ensureProjectExists(projectId);
    if (!this.sprintRepository.findById(projectId, sprintId)) {
      throw new NotFoundError(
        `Sprint with ID ${sprintId} not found in project ${projectId}.`
      );
    }

    const now = new Date().toISOString();
    let closedTaskCount = 0;
    const transaction = this.db.transaction(() => {
      if (closeTasks) {
        closedTaskCount = this.taskRepository.updateSprintStatus(
          projectId,
          sprintId,
          "done",
          now
        );
      }
      this.sprintRepository.updateStatus(projectId, sprintId, "closed", now);
    });
    transaction();

    return { sprint_id: sprintId, closed_task_count: closedTaskCount };
  }

  public async assignToSprint(input: AssignToSprintInput): Promise<{
    assigned_count: number;
    sprint_id: string | null;
    task_ids: string[];
  }> {
    this.ensureProjectExists(input.project_id);
    const sprint = input.sprint_id
      ? this.sprintRepository.findById(input.project_id, input.sprint_id)
      : undefined;
    if (input.sprint_id && !sprint) {
      throw new NotFoundError(
        `Sprint with ID ${input.sprint_id} not found in project ${input.project_id}.`
      );
    }

    const taskIds = this.resolveSprintAssignmentTaskIds(
      input,
      sprint?.milestone ?? null
    );
    this.ensureTasksExist(input.project_id, taskIds);

    for (const taskId of taskIds) {
      const task = this.taskRepository.findById(input.project_id, taskId);
      if (task?.item_type === "epic" && input.sprint_id) {
        throw new ValidationError(
          "Epics cannot be assigned directly to a sprint. Assign descendant stories/tasks instead."
        );
      }
    }

    const assignedCount = this.taskRepository.updateSprintAssignment(
      input.project_id,
      taskIds,
      input.sprint_id,
      new Date().toISOString()
    );
    return {
      assigned_count: assignedCount,
      sprint_id: input.sprint_id,
      task_ids: taskIds,
    };
  }

  public async getSprintProgress(
    projectId: string,
    sprintId: string
  ): Promise<SprintProgress> {
    this.ensureProjectExists(projectId);
    if (!this.sprintRepository.findById(projectId, sprintId)) {
      throw new NotFoundError(
        `Sprint with ID ${sprintId} not found in project ${projectId}.`
      );
    }

    const sprintItems = this.taskRepository.findBySprintId(projectId, sprintId);
    const byStatus: Record<TaskStatus, number> = {
      todo: 0,
      "in-progress": 0,
      review: 0,
      done: 0,
      cancelled: 0,
    };
    for (const item of sprintItems) {
      byStatus[item.status] += 1;
    }

    const sprintTasks = sprintItems.filter((item) => item.item_type === "task");
    const doneTasks = sprintTasks.filter((task) =>
      TERMINAL_TASK_STATUSES.has(task.status)
    ).length;

    return {
      sprint_id: sprintId,
      project_id: projectId,
      total_items: sprintItems.length,
      total_tasks: sprintTasks.length,
      done_tasks: doneTasks,
      open_tasks: sprintTasks.length - doneTasks,
      progress_percent:
        sprintTasks.length === 0
          ? 0
          : Math.round((doneTasks / sprintTasks.length) * 100),
      by_status: byStatus,
    };
  }

  public async getEpicProgress(
    projectId: string,
    epicId: string
  ): Promise<EpicProgress> {
    this.ensureProjectExists(projectId);
    const epic = this.taskRepository.findById(projectId, epicId);
    if (!epic || epic.item_type !== "epic") {
      throw new NotFoundError(
        `Epic with ID ${epicId} not found in project ${projectId}.`
      );
    }

    const items = this.taskRepository.findDescendants(projectId, epicId);
    const byStatus: Record<TaskStatus, number> = {
      todo: 0,
      "in-progress": 0,
      review: 0,
      done: 0,
      cancelled: 0,
    };
    for (const item of items) {
      byStatus[item.status] += 1;
    }

    const stories = items.filter((item) => item.item_type === "story");
    const tasks = items.filter((item) => item.item_type === "task");
    const doneTasks = tasks.filter((task) =>
      TERMINAL_TASK_STATUSES.has(task.status)
    ).length;

    return {
      epic_id: epicId,
      project_id: projectId,
      total_items: items.length,
      total_stories: stories.length,
      total_tasks: tasks.length,
      done_tasks: doneTasks,
      open_tasks: tasks.length - doneTasks,
      progress_percent:
        tasks.length === 0 ? 0 : Math.round((doneTasks / tasks.length) * 100),
      by_status: byStatus,
    };
  }

  public async getSprintBacklog(
    projectId: string,
    sprintId: string
  ): Promise<StructuredTaskData[]> {
    this.ensureProjectExists(projectId);
    if (!this.sprintRepository.findById(projectId, sprintId)) {
      throw new NotFoundError(
        `Sprint with ID ${sprintId} not found in project ${projectId}.`
      );
    }

    const sprintItems = this.taskRepository.findBySprintId(projectId, sprintId);
    const allTasks = this.taskRepository.findAllTasksForProject(projectId);
    const requiredIds = new Set(sprintItems.map((item) => item.task_id));

    for (const item of sprintItems) {
      let currentParentId = item.parent_task_id ?? null;
      while (currentParentId) {
        const parent = allTasks.find(
          (candidate) => candidate.task_id === currentParentId
        );
        if (!parent) {
          break;
        }
        requiredIds.add(parent.task_id);
        currentParentId = parent.parent_task_id ?? null;
      }
    }

    return this.structureTasks(
      allTasks.filter((item) => requiredIds.has(item.task_id)),
      true
    );
  }

  private structureTasks(
    tasks: TaskData[],
    includeOrphansAsRoots: boolean
  ): StructuredTaskData[] {
    const taskMap: Map<string, StructuredTaskData> = new Map();
    const rootTasks: StructuredTaskData[] = [];
    for (const task of tasks) {
      taskMap.set(task.task_id, { ...task, subtasks: [] });
    }
    for (const task of tasks) {
      const structuredTask = taskMap.get(task.task_id)!;
      if (task.parent_task_id && taskMap.has(task.parent_task_id)) {
        taskMap.get(task.parent_task_id)!.subtasks!.push(structuredTask);
      } else if (!task.parent_task_id || includeOrphansAsRoots) {
        rootTasks.push(structuredTask);
      }
    }
    return rootTasks;
  }

  private prepareBatchCreates(
    projectId: string,
    items: BatchCreateWorkItemInput[]
  ): {
    resolvedItems: { task: TaskData; dependencies: string[] }[];
    idMap: Map<string, string>;
  } {
    const idMap = new Map<string, string>();
    const now = new Date().toISOString();
    const resolvedItems = items.map((item) => {
      if (item.project_id !== projectId) {
        throw new ValidationError(
          "All batch work items must use the same project_id."
        );
      }
      if (item.client_id) {
        if (idMap.has(item.client_id)) {
          throw new ValidationError(
            `Duplicate client_id in batch: ${item.client_id}.`
          );
        }
        idMap.set(item.client_id, uuidv4());
      }

      return {
        item,
        taskId: item.client_id ? idMap.get(item.client_id)! : uuidv4(),
      };
    });

    const resolvedByClientId = new Map(
      resolvedItems
        .filter((item) => item.item.client_id)
        .map((item) => [item.item.client_id!, item])
    );
    const tasksById = new Map<string, TaskData>();
    const output: { task: TaskData; dependencies: string[] }[] = [];

    for (const resolved of resolvedItems) {
      const itemType = resolved.item.item_type ?? "task";
      const parentTaskId = this.resolveBatchReference(
        resolved.item.parent_task_id ?? null,
        resolved.item.parent_client_id,
        idMap,
        "parent"
      );
      const sprintId = resolved.item.sprint_id ?? null;

      this.validateBatchPlacement(
        projectId,
        itemType,
        parentTaskId,
        sprintId,
        tasksById,
        resolvedByClientId
      );

      const dependencies = [
        ...(resolved.item.dependencies ?? []),
        ...(resolved.item.dependency_client_ids ?? []).map((clientId) => {
          const taskId = idMap.get(clientId);
          if (!taskId) {
            throw new ValidationError(
              `Unknown dependency client_id in batch: ${clientId}.`
            );
          }
          return taskId;
        }),
      ];
      this.validateBatchDependencies(
        projectId,
        resolved.taskId,
        dependencies,
        tasksById,
        idMap
      );

      const task: TaskData = {
        task_id: resolved.taskId,
        project_id: projectId,
        parent_task_id: parentTaskId,
        sprint_id: sprintId,
        milestone: resolved.item.milestone ?? null,
        item_type: itemType,
        description: resolved.item.description,
        status: resolved.item.status ?? "todo",
        priority: resolved.item.priority ?? "medium",
        created_at: now,
        updated_at: now,
      };
      tasksById.set(task.task_id, task);
      output.push({ task, dependencies });
    }

    this.validateResolvedDependencyGraph(projectId, output);

    return { resolvedItems: output, idMap };
  }

  private resolveSprintAssignmentTaskIds(
    input: AssignToSprintInput,
    sprintMilestone: string | null
  ): string[] {
    if (input.task_ids && input.task_ids.length > 0) {
      return this.withOptionalDescendants(
        input.project_id,
        input.task_ids,
        input.include_subtasks ?? false
      );
    }

    let candidates: TaskData[];
    if (input.epic_id) {
      const epic = this.taskRepository.findById(
        input.project_id,
        input.epic_id
      );
      if (!epic || epic.item_type !== "epic") {
        throw new NotFoundError(
          `Epic with ID ${input.epic_id} not found in project ${input.project_id}.`
        );
      }
      candidates = this.taskRepository.findDescendants(
        input.project_id,
        input.epic_id
      );
    } else {
      const milestone =
        input.milestone !== undefined ? input.milestone : sprintMilestone;
      const hasSelector =
        input.item_type !== undefined ||
        input.status !== undefined ||
        input.parent_task_id !== undefined ||
        input.milestone !== undefined ||
        milestone !== null;

      if (!hasSelector) {
        throw new ValidationError(
          "Provide task_ids or at least one selector such as milestone, epic_id, item_type, status, or parent_task_id."
        );
      }

      candidates = this.taskRepository.findByProjectId(input.project_id, {
        item_type: input.item_type,
        status: input.status,
        parent_task_id: input.parent_task_id,
        milestone: input.milestone !== undefined ? input.milestone : milestone,
      });
    }

    const filtered = candidates.filter(
      (task) =>
        task.item_type !== "epic" &&
        (input.item_type === undefined || task.item_type === input.item_type) &&
        (input.status === undefined || task.status === input.status) &&
        (input.parent_task_id === undefined ||
          task.parent_task_id === input.parent_task_id) &&
        (input.milestone === undefined || task.milestone === input.milestone)
    );

    const taskIds = filtered.map((task) => task.task_id);
    if (taskIds.length === 0) {
      throw new ValidationError(
        "No stories or tasks matched the sprint assignment selector."
      );
    }
    return this.withOptionalDescendants(
      input.project_id,
      taskIds,
      input.include_subtasks ?? false
    );
  }

  private withOptionalDescendants(
    projectId: string,
    taskIds: string[],
    includeSubtasks: boolean
  ): string[] {
    if (!includeSubtasks) {
      return [...new Set(taskIds)];
    }

    const selected = new Set(taskIds);
    for (const taskId of taskIds) {
      for (const descendant of this.taskRepository.findDescendants(
        projectId,
        taskId
      )) {
        if (descendant.item_type !== "epic") {
          selected.add(descendant.task_id);
        }
      }
    }
    return [...selected];
  }

  private resolveBatchReference(
    directId: string | null,
    clientId: string | undefined,
    idMap: Map<string, string>,
    fieldName: string
  ): string | null {
    if (directId && clientId) {
      throw new ValidationError(
        `Provide either ${fieldName}_task_id or ${fieldName}_client_id, not both.`
      );
    }
    if (!clientId) {
      return directId;
    }
    const resolvedId = idMap.get(clientId);
    if (!resolvedId) {
      throw new ValidationError(
        `Unknown ${fieldName}_client_id in batch: ${clientId}.`
      );
    }
    return resolvedId;
  }

  private validateBatchPlacement(
    projectId: string,
    itemType: WorkItemType,
    parentTaskId: string | null,
    sprintId: string | null,
    batchTasksById: Map<string, TaskData>,
    resolvedByClientId: Map<
      string,
      { item: BatchCreateWorkItemInput; taskId: string }
    >
  ): void {
    if (!parentTaskId || batchTasksById.has(parentTaskId)) {
      const parentTask = parentTaskId
        ? batchTasksById.get(parentTaskId)
        : undefined;
      if (itemType === "epic" && parentTaskId) {
        throw new ValidationError("Epics cannot have a parent task.");
      }
      if (itemType === "epic" && sprintId) {
        throw new ValidationError(
          "Epics cannot be assigned directly to a sprint."
        );
      }
      if (
        parentTask &&
        itemType === "story" &&
        parentTask.item_type !== "epic"
      ) {
        throw new ValidationError("Stories can only be parented by epics.");
      }
      if (
        parentTask &&
        itemType === "task" &&
        parentTask.item_type === "task"
      ) {
        throw new ValidationError(
          "Tasks can only be parented by stories or epics."
        );
      }
      if (sprintId && !this.sprintRepository.findById(projectId, sprintId)) {
        throw new ValidationError(
          `Sprint ${sprintId} was not found in project ${projectId}.`
        );
      }
      return;
    }

    const futureParent = [...resolvedByClientId.values()].find(
      (candidate) => candidate.taskId === parentTaskId
    );
    if (futureParent) {
      throw new ValidationError(
        `Parent client item ${futureParent.item.client_id} must appear before its children in the batch.`
      );
    }

    this.validateWorkItemPlacement(projectId, itemType, parentTaskId, sprintId);
  }

  private validateBatchDependencies(
    projectId: string,
    taskId: string,
    dependencies: string[],
    batchTasksById: Map<string, TaskData>,
    idMap: Map<string, string>
  ): void {
    if (dependencies.includes(taskId)) {
      throw new ValidationError(`Task ${taskId} cannot depend on itself.`);
    }
    const allBatchTaskIds = new Set(idMap.values());
    const existingDependencies = dependencies.filter(
      (dependency) =>
        !batchTasksById.has(dependency) && !allBatchTaskIds.has(dependency)
    );
    this.validateDependencies(projectId, taskId, existingDependencies);
  }

  private validateResolvedDependencyGraph(
    projectId: string,
    resolvedItems: { task: TaskData; dependencies: string[] }[]
  ): void {
    if (resolvedItems.length === 0) {
      return;
    }

    const existingTasks = this.taskRepository.findAllTasksForProject(projectId);
    const existingDependencies =
      this.taskRepository.findAllDependenciesForProject(projectId);
    const batchTaskIds = new Set(
      resolvedItems.map((item) => item.task.task_id)
    );
    const combinedTasks = [
      ...existingTasks.filter((task) => !batchTaskIds.has(task.task_id)),
      ...resolvedItems.map((item) => item.task),
    ];
    const combinedDependencies = [
      ...existingDependencies.filter(
        (dependency) => !batchTaskIds.has(dependency.task_id)
      ),
      ...resolvedItems.flatMap((item) =>
        item.dependencies.map((dependencyId) => ({
          task_id: item.task.task_id,
          depends_on_task_id: dependencyId,
        }))
      ),
    ];
    const cycles = this.findDependencyCycles(
      combinedTasks,
      this.buildDependencyMap(combinedDependencies)
    );

    if (cycles.length > 0) {
      throw new ValidationError(
        `Batch dependencies would create a cycle: ${cycles[0].join(" -> ")}`
      );
    }
  }

  private ensureProjectExists(projectId: string): void {
    if (!this.projectRepository.findById(projectId)) {
      throw new NotFoundError(`Project with ID ${projectId} not found.`);
    }
  }

  private ensureTasksExist(projectId: string, taskIds: string[]): void {
    const existenceCheck = this.taskRepository.checkTasksExist(
      projectId,
      taskIds
    );
    if (!existenceCheck.allExist) {
      throw new NotFoundError(
        `One or more tasks not found in project ${projectId}: ${existenceCheck.missingIds.join(", ")}`
      );
    }
  }

  private validateDependencies(
    projectId: string,
    taskId: string,
    dependencies?: string[]
  ): void {
    if (dependencies === undefined || dependencies.length === 0) {
      return;
    }

    const depCheck = this.taskRepository.checkTasksExist(
      projectId,
      dependencies
    );
    if (!depCheck.allExist) {
      throw new ValidationError(
        `One or more dependency tasks not found in project ${projectId}: ${depCheck.missingIds.join(", ")}`
      );
    }

    if (dependencies.includes(taskId)) {
      throw new ValidationError(`Task ${taskId} cannot depend on itself.`);
    }

    if (this.wouldCreateDependencyCycle(projectId, taskId, dependencies)) {
      throw new ValidationError(
        `Dependencies for task ${taskId} would create a cycle.`
      );
    }
  }

  private buildDependencyMap(
    dependencies: DependencyData[]
  ): Map<string, string[]> {
    const dependencyMap = new Map<string, string[]>();
    for (const dependency of dependencies) {
      const existing = dependencyMap.get(dependency.task_id) ?? [];
      existing.push(dependency.depends_on_task_id);
      dependencyMap.set(dependency.task_id, existing);
    }
    return dependencyMap;
  }

  private buildDependentMap(
    dependencies: DependencyData[]
  ): Map<string, string[]> {
    const dependentMap = new Map<string, string[]>();
    for (const dependency of dependencies) {
      const existing = dependentMap.get(dependency.depends_on_task_id) ?? [];
      existing.push(dependency.task_id);
      dependentMap.set(dependency.depends_on_task_id, existing);
    }
    return dependentMap;
  }

  private isTaskInNextTaskScope(
    task: TaskData,
    selectedSprintId?: string | null
  ): boolean {
    if (selectedSprintId === undefined) {
      return true;
    }
    if (selectedSprintId === null) {
      return task.sprint_id === null || task.sprint_id === undefined;
    }
    return task.sprint_id === selectedSprintId;
  }

  private areDependenciesTerminal(
    task: TaskData,
    dependencyMap: Map<string, string[]>,
    allTasksById: Map<string, TaskData>
  ): boolean {
    return (dependencyMap.get(task.task_id) ?? []).every((dependencyId) => {
      const dependency = allTasksById.get(dependencyId);
      return (
        dependency !== undefined &&
        TERMINAL_TASK_STATUSES.has(dependency.status)
      );
    });
  }

  private toNextTaskCandidate(
    projectId: string,
    task: TaskData,
    dependencyMap: Map<string, string[]>,
    dependentMap: Map<string, string[]>,
    allTasksById: Map<string, TaskData>
  ): NextTaskCandidate {
    const taskWithDetails = {
      ...task,
      dependencies: this.taskRepository.findDependencies(task.task_id),
      subtasks: this.taskRepository.findSubtasks(task.task_id),
    };
    const complexity = this.estimateTaskComplexity(
      task,
      dependencyMap,
      allTasksById
    );
    const unblocks = this.findTasksUnblockedBy(
      task.task_id,
      dependencyMap,
      dependentMap,
      allTasksById
    );
    const dependencyDepth = this.findDownstreamDependencyDepth(
      task.task_id,
      dependentMap,
      allTasksById
    );
    const score = this.scoreNextTaskCandidate(
      task,
      complexity,
      dependencyDepth,
      unblocks.length
    );
    const reasons = [
      "ready",
      `${complexity} complexity`,
      `unblocks ${unblocks.length} task${unblocks.length === 1 ? "" : "s"}`,
      `dependency depth ${dependencyDepth}`,
      `${task.priority} priority`,
    ];

    return {
      task: taskWithDetails,
      score,
      complexity,
      dependency_depth: dependencyDepth,
      unblocks_count: unblocks.length,
      unblocks,
      reasons,
    };
  }

  private estimateTaskComplexity(
    task: TaskData,
    dependencyMap: Map<string, string[]>,
    allTasksById: Map<string, TaskData>
  ): TaskComplexity {
    const dependencyCount = dependencyMap.get(task.task_id)?.length ?? 0;
    const subtaskCount = [...allTasksById.values()].filter(
      (candidate) => candidate.parent_task_id === task.task_id
    ).length;
    const descriptionLength = task.description.trim().length;
    const score =
      dependencyCount +
      subtaskCount * 2 +
      (descriptionLength > 220 ? 2 : descriptionLength > 120 ? 1 : 0);

    if (score <= 1) {
      return "low";
    }
    if (score <= 3) {
      return "medium";
    }
    return "high";
  }

  private findTasksUnblockedBy(
    taskId: string,
    dependencyMap: Map<string, string[]>,
    dependentMap: Map<string, string[]>,
    allTasksById: Map<string, TaskData>
  ): string[] {
    return (dependentMap.get(taskId) ?? []).filter((dependentId) => {
      const dependent = allTasksById.get(dependentId);
      if (!dependent || dependent.status !== "todo") {
        return false;
      }

      return (dependencyMap.get(dependentId) ?? []).every((dependencyId) => {
        if (dependencyId === taskId) {
          return true;
        }
        const dependency = allTasksById.get(dependencyId);
        return (
          dependency !== undefined &&
          TERMINAL_TASK_STATUSES.has(dependency.status)
        );
      });
    });
  }

  private findDownstreamDependencyDepth(
    taskId: string,
    dependentMap: Map<string, string[]>,
    allTasksById: Map<string, TaskData>,
    visited = new Set<string>()
  ): number {
    if (visited.has(taskId)) {
      return 0;
    }
    visited.add(taskId);

    const dependentDepths = (dependentMap.get(taskId) ?? [])
      .filter((dependentId) => allTasksById.get(dependentId)?.status !== "done")
      .map(
        (dependentId) =>
          1 +
          this.findDownstreamDependencyDepth(
            dependentId,
            dependentMap,
            allTasksById,
            new Set(visited)
          )
      );

    return dependentDepths.length === 0 ? 0 : Math.max(...dependentDepths);
  }

  private scoreNextTaskCandidate(
    task: TaskData,
    complexity: TaskComplexity,
    dependencyDepth: number,
    unblocksCount: number
  ): number {
    const priorityScore: Record<TaskPriority, number> = {
      high: 30,
      medium: 20,
      low: 10,
    };
    const complexityScore: Record<TaskComplexity, number> = {
      low: 15,
      medium: 8,
      high: 0,
    };

    return (
      unblocksCount * 100 +
      dependencyDepth * 25 +
      priorityScore[task.priority] +
      complexityScore[complexity]
    );
  }

  private compareNextTaskCandidates(
    a: NextTaskCandidate,
    b: NextTaskCandidate
  ): number {
    if (a.score !== b.score) {
      return b.score - a.score;
    }
    return a.task.created_at.localeCompare(b.task.created_at);
  }

  private complexityRank(complexity: TaskComplexity): number {
    const ranks: Record<TaskComplexity, number> = {
      low: 1,
      medium: 2,
      high: 3,
    };
    return ranks[complexity];
  }

  private findDependencyCycles(
    tasks: TaskData[],
    dependencyMap: Map<string, string[]>
  ): string[][] {
    const taskIds = new Set(tasks.map((task) => task.task_id));
    const state = new Map<string, "visiting" | "visited">();
    const stack: string[] = [];
    const cycleKeys = new Set<string>();
    const cycles: string[][] = [];

    const visit = (taskId: string): void => {
      const currentState = state.get(taskId);
      if (currentState === "visited") {
        return;
      }
      if (currentState === "visiting") {
        const startIndex = stack.indexOf(taskId);
        const cycle = [...stack.slice(startIndex), taskId];
        const key = cycle.slice(0, -1).sort().join("|");
        if (!cycleKeys.has(key)) {
          cycleKeys.add(key);
          cycles.push(cycle);
        }
        return;
      }

      state.set(taskId, "visiting");
      stack.push(taskId);
      for (const dependencyId of dependencyMap.get(taskId) ?? []) {
        if (taskIds.has(dependencyId)) {
          visit(dependencyId);
        }
      }
      stack.pop();
      state.set(taskId, "visited");
    };

    for (const task of tasks) {
      visit(task.task_id);
    }

    return cycles;
  }

  private wouldCreateDependencyCycle(
    projectId: string,
    taskId: string,
    dependencies: string[]
  ): boolean {
    const existingDependencies =
      this.taskRepository.findAllDependenciesForProject(projectId);
    const dependencyMap = this.buildDependencyMap(
      existingDependencies.filter((dependency) => dependency.task_id !== taskId)
    );
    dependencyMap.set(taskId, dependencies);
    return dependencies.some((dependencyId) =>
      this.hasDependencyPath(dependencyId, taskId, dependencyMap)
    );
  }

  private hasDependencyPath(
    startTaskId: string,
    targetTaskId: string,
    dependencyMap: Map<string, string[]>,
    visited = new Set<string>()
  ): boolean {
    if (startTaskId === targetTaskId) {
      return true;
    }
    if (visited.has(startTaskId)) {
      return false;
    }
    visited.add(startTaskId);
    return (dependencyMap.get(startTaskId) ?? []).some((dependencyId) =>
      this.hasDependencyPath(dependencyId, targetTaskId, dependencyMap, visited)
    );
  }

  private validateWorkItemPlacement(
    projectId: string,
    itemType: WorkItemType,
    parentTaskId: string | null,
    sprintId: string | null,
    taskId?: string
  ): void {
    if (itemType === "epic" && parentTaskId) {
      throw new ValidationError("Epics cannot have a parent task.");
    }

    if (itemType === "epic" && sprintId) {
      throw new ValidationError(
        "Epics cannot be assigned directly to a sprint."
      );
    }

    if ((itemType === "story" || itemType === "task") && parentTaskId) {
      if (taskId && parentTaskId === taskId) {
        throw new ValidationError(`Task ${taskId} cannot be its own parent.`);
      }

      const parentTask = this.taskRepository.findById(projectId, parentTaskId);
      if (!parentTask) {
        throw new ValidationError(
          `Parent task ${parentTaskId} was not found in project ${projectId}.`
        );
      }

      if (itemType === "story" && parentTask.item_type !== "epic") {
        throw new ValidationError("Stories can only be parented by epics.");
      }

      if (itemType === "task" && parentTask.item_type === "task") {
        throw new ValidationError(
          "Tasks can only be parented by stories or epics."
        );
      }
    }

    if (sprintId && !this.sprintRepository.findById(projectId, sprintId)) {
      throw new ValidationError(
        `Sprint ${sprintId} was not found in project ${projectId}.`
      );
    }
  }
}
