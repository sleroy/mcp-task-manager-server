import { Database as Db } from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { ProjectRepository } from '../repositories/ProjectRepository.js';
import { SprintRepository } from '../repositories/SprintRepository.js';
import { TaskRepository, TaskData } from '../repositories/TaskRepository.js';
import { TaskPriority, TaskStatus, WorkItemType } from '../types/taskTypes.js';
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors.js';

export interface AddTaskInput {
    project_id: string;
    description: string;
    item_type?: WorkItemType;
    parent_task_id?: string | null;
    sprint_id?: string | null;
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
    include_subtasks?: boolean;
}

export interface StructuredTaskData extends TaskData {
    subtasks?: StructuredTaskData[];
}

export interface FullTaskData extends TaskData {
    dependencies: string[];
    subtasks: TaskData[];
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

export class TaskService {
    constructor(
        private db: Db,
        private taskRepository: TaskRepository,
        private projectRepository: ProjectRepository,
        private sprintRepository: SprintRepository
    ) {}

    public async addTask(input: AddTaskInput): Promise<TaskData> {
        this.ensureProjectExists(input.project_id);

        const itemType = input.item_type ?? 'task';
        const parentTaskId = input.parent_task_id ?? null;
        const sprintId = input.sprint_id ?? null;
        this.validateWorkItemPlacement(input.project_id, itemType, parentTaskId, sprintId);

        const taskId = uuidv4();
        this.validateDependencies(input.project_id, taskId, input.dependencies);

        const now = new Date().toISOString();
        const newTaskData: TaskData = {
            task_id: taskId,
            project_id: input.project_id,
            parent_task_id: parentTaskId,
            sprint_id: sprintId,
            item_type: itemType,
            description: input.description,
            status: input.status ?? 'todo',
            priority: input.priority ?? 'medium',
            created_at: now,
            updated_at: now,
        };

        this.taskRepository.create(newTaskData, input.dependencies ?? []);
        return newTaskData;
    }

    public async listTasks(options: ListTasksOptions): Promise<TaskData[] | StructuredTaskData[]> {
        this.ensureProjectExists(options.project_id);

        const allTasks = this.taskRepository.findByProjectId(options.project_id, {
            status: options.status,
            item_type: options.item_type,
            sprint_id: options.sprint_id,
            parent_task_id: options.parent_task_id,
        });

        if (!options.include_subtasks) {
            return options.parent_task_id === undefined
                ? allTasks.filter(task => !task.parent_task_id)
                : allTasks;
        }

        return this.structureTasks(allTasks, options.parent_task_id !== undefined);
    }

    public async listEpics(projectId: string, status?: TaskStatus, includeSubtasks = true): Promise<TaskData[] | StructuredTaskData[]> {
        this.ensureProjectExists(projectId);
        const allTasks = this.taskRepository.findAllTasksForProject(projectId);
        const epicIds = new Set(
            allTasks
                .filter(task => task.item_type === 'epic' && (status === undefined || task.status === status))
                .map(task => task.task_id)
        );

        if (!includeSubtasks) {
            return allTasks.filter(task => epicIds.has(task.task_id));
        }

        const requiredIds = new Set(epicIds);
        for (const epicId of epicIds) {
            for (const descendant of this.taskRepository.findDescendants(projectId, epicId)) {
                requiredIds.add(descendant.task_id);
            }
        }

        return this.structureTasks(allTasks.filter(task => requiredIds.has(task.task_id)), false);
    }

    public async listStories(options: {
        project_id: string;
        epic_id?: string;
        sprint_id?: string;
        status?: TaskStatus;
        include_subtasks?: boolean;
    }): Promise<TaskData[] | StructuredTaskData[]> {
        this.ensureProjectExists(options.project_id);
        const allTasks = this.taskRepository.findAllTasksForProject(options.project_id);
        const stories = allTasks.filter(task =>
            task.item_type === 'story' &&
            (options.status === undefined || task.status === options.status) &&
            (options.epic_id === undefined || task.parent_task_id === options.epic_id) &&
            (options.sprint_id === undefined || task.sprint_id === options.sprint_id)
        );

        if (!options.include_subtasks) {
            return stories;
        }

        const requiredIds = new Set(stories.map(story => story.task_id));
        for (const story of stories) {
            for (const descendant of this.taskRepository.findDescendants(options.project_id, story.task_id)) {
                requiredIds.add(descendant.task_id);
            }
        }

        return this.structureTasks(allTasks.filter(task => requiredIds.has(task.task_id)), true);
    }

    public async getTaskById(projectId: string, taskId: string): Promise<FullTaskData> {
        const task = this.taskRepository.findById(projectId, taskId);
        if (!task) {
            throw new NotFoundError(`Task with ID ${taskId} not found in project ${projectId}.`);
        }

        return {
            ...task,
            dependencies: this.taskRepository.findDependencies(taskId),
            subtasks: this.taskRepository.findSubtasks(taskId),
        };
    }

    public async setTaskStatus(projectId: string, taskIds: string[], status: TaskStatus): Promise<number> {
        this.ensureProjectExists(projectId);
        this.ensureTasksExist(projectId, taskIds);
        return this.taskRepository.updateStatus(projectId, taskIds, status, new Date().toISOString());
    }

    public async closeTask(projectId: string, taskId: string, includeSubtasks = true): Promise<{ closed_count: number; task_ids: string[] }> {
        this.ensureProjectExists(projectId);
        this.ensureTasksExist(projectId, [taskId]);

        const taskIds = includeSubtasks
            ? [taskId, ...this.taskRepository.findDescendants(projectId, taskId).map(task => task.task_id)]
            : [taskId];
        const closedCount = this.taskRepository.updateStatus(projectId, taskIds, 'done', new Date().toISOString());
        return { closed_count: closedCount, task_ids: taskIds };
    }

    public async expandTask(input: ExpandTaskInput): Promise<FullTaskData> {
        this.ensureProjectExists(input.project_id);

        const expandTransaction = this.db.transaction(() => {
            const parentTask = this.taskRepository.findById(input.project_id, input.task_id);
            if (!parentTask) {
                throw new NotFoundError(`Parent task with ID ${input.task_id} not found in project ${input.project_id}.`);
            }

            const existingSubtasks = this.taskRepository.findSubtasks(input.task_id);
            if (existingSubtasks.length > 0 && !input.force) {
                throw new ConflictError(`Task ${input.task_id} already has subtasks. Use force=true to replace them.`);
            }
            if (existingSubtasks.length > 0) {
                this.taskRepository.deleteSubtasks(input.task_id);
            }

            const now = new Date().toISOString();
            const createdSubtasks = input.subtask_descriptions.map(description => {
                const subtask: TaskData = {
                    task_id: uuidv4(),
                    project_id: input.project_id,
                    parent_task_id: input.task_id,
                    sprint_id: parentTask.sprint_id ?? null,
                    item_type: 'task',
                    description,
                    status: 'todo',
                    priority: 'medium',
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

    public async getNextTask(projectId: string, sprintId?: string): Promise<FullTaskData | null> {
        this.ensureProjectExists(projectId);
        let selectedSprintId = sprintId;

        if (!selectedSprintId) {
            selectedSprintId = this.sprintRepository.findMostRecentActive(projectId)?.sprint_id;
        } else if (!this.sprintRepository.findById(projectId, selectedSprintId)) {
            throw new NotFoundError(`Sprint with ID ${selectedSprintId} not found in project ${projectId}.`);
        }

        const readyTasks = this.taskRepository.findReadyTasks(projectId, selectedSprintId);
        if (readyTasks.length === 0) {
            return null;
        }

        return this.getTaskById(projectId, readyTasks[0].task_id);
    }

    public async updateTask(input: {
        project_id: string;
        task_id: string;
        description?: string;
        priority?: TaskPriority;
        parent_task_id?: string | null;
        sprint_id?: string | null;
        dependencies?: string[];
    }): Promise<FullTaskData> {
        if (
            input.description === undefined &&
            input.priority === undefined &&
            input.parent_task_id === undefined &&
            input.sprint_id === undefined &&
            input.dependencies === undefined
        ) {
            throw new ValidationError('At least one field (description, priority, parent_task_id, sprint_id, or dependencies) must be provided for update.');
        }

        this.ensureProjectExists(input.project_id);
        const existingTask = this.taskRepository.findById(input.project_id, input.task_id);
        if (!existingTask) {
            throw new NotFoundError(`Task with ID ${input.task_id} not found in project ${input.project_id}.`);
        }

        this.validateWorkItemPlacement(
            input.project_id,
            existingTask.item_type,
            input.parent_task_id !== undefined ? input.parent_task_id : existingTask.parent_task_id ?? null,
            input.sprint_id !== undefined ? input.sprint_id : existingTask.sprint_id ?? null,
            input.task_id
        );
        this.validateDependencies(input.project_id, input.task_id, input.dependencies);

        const updatedTaskData = this.taskRepository.updateTask(input.project_id, input.task_id, {
            description: input.description,
            priority: input.priority,
            parent_task_id: input.parent_task_id,
            sprint_id: input.sprint_id,
            dependencies: input.dependencies,
        }, new Date().toISOString());

        return {
            ...updatedTaskData,
            dependencies: this.taskRepository.findDependencies(input.task_id),
            subtasks: this.taskRepository.findSubtasks(input.task_id),
        };
    }

    public async deleteTasks(projectId: string, taskIds: string[]): Promise<number> {
        this.ensureProjectExists(projectId);
        this.ensureTasksExist(projectId, taskIds);
        return this.taskRepository.deleteTasks(projectId, taskIds);
    }

    public async closeSprint(projectId: string, sprintId: string, closeTasks = true): Promise<{ sprint_id: string; closed_task_count: number }> {
        this.ensureProjectExists(projectId);
        if (!this.sprintRepository.findById(projectId, sprintId)) {
            throw new NotFoundError(`Sprint with ID ${sprintId} not found in project ${projectId}.`);
        }

        const now = new Date().toISOString();
        let closedTaskCount = 0;
        const transaction = this.db.transaction(() => {
            if (closeTasks) {
                closedTaskCount = this.taskRepository.updateSprintStatus(projectId, sprintId, 'done', now);
            }
            this.sprintRepository.updateStatus(projectId, sprintId, 'closed', now);
        });
        transaction();

        return { sprint_id: sprintId, closed_task_count: closedTaskCount };
    }

    public async assignToSprint(projectId: string, taskIds: string[], sprintId: string | null): Promise<{ assigned_count: number; sprint_id: string | null }> {
        this.ensureProjectExists(projectId);
        this.ensureTasksExist(projectId, taskIds);
        if (sprintId && !this.sprintRepository.findById(projectId, sprintId)) {
            throw new NotFoundError(`Sprint with ID ${sprintId} not found in project ${projectId}.`);
        }

        for (const taskId of taskIds) {
            const task = this.taskRepository.findById(projectId, taskId);
            if (task?.item_type === 'epic' && sprintId) {
                throw new ValidationError('Epics cannot be assigned directly to a sprint.');
            }
        }

        const assignedCount = this.taskRepository.updateSprintAssignment(projectId, taskIds, sprintId, new Date().toISOString());
        return { assigned_count: assignedCount, sprint_id: sprintId };
    }

    public async getSprintProgress(projectId: string, sprintId: string): Promise<SprintProgress> {
        this.ensureProjectExists(projectId);
        if (!this.sprintRepository.findById(projectId, sprintId)) {
            throw new NotFoundError(`Sprint with ID ${sprintId} not found in project ${projectId}.`);
        }

        const sprintItems = this.taskRepository.findBySprintId(projectId, sprintId);
        const byStatus: Record<TaskStatus, number> = { todo: 0, 'in-progress': 0, review: 0, done: 0 };
        for (const item of sprintItems) {
            byStatus[item.status] += 1;
        }

        const sprintTasks = sprintItems.filter(item => item.item_type === 'task');
        const doneTasks = sprintTasks.filter(task => task.status === 'done').length;

        return {
            sprint_id: sprintId,
            project_id: projectId,
            total_items: sprintItems.length,
            total_tasks: sprintTasks.length,
            done_tasks: doneTasks,
            open_tasks: sprintTasks.length - doneTasks,
            progress_percent: sprintTasks.length === 0 ? 0 : Math.round((doneTasks / sprintTasks.length) * 100),
            by_status: byStatus,
        };
    }

    public async getEpicProgress(projectId: string, epicId: string): Promise<EpicProgress> {
        this.ensureProjectExists(projectId);
        const epic = this.taskRepository.findById(projectId, epicId);
        if (!epic || epic.item_type !== 'epic') {
            throw new NotFoundError(`Epic with ID ${epicId} not found in project ${projectId}.`);
        }

        const items = this.taskRepository.findDescendants(projectId, epicId);
        const byStatus: Record<TaskStatus, number> = { todo: 0, 'in-progress': 0, review: 0, done: 0 };
        for (const item of items) {
            byStatus[item.status] += 1;
        }

        const stories = items.filter(item => item.item_type === 'story');
        const tasks = items.filter(item => item.item_type === 'task');
        const doneTasks = tasks.filter(task => task.status === 'done').length;

        return {
            epic_id: epicId,
            project_id: projectId,
            total_items: items.length,
            total_stories: stories.length,
            total_tasks: tasks.length,
            done_tasks: doneTasks,
            open_tasks: tasks.length - doneTasks,
            progress_percent: tasks.length === 0 ? 0 : Math.round((doneTasks / tasks.length) * 100),
            by_status: byStatus,
        };
    }

    public async getSprintBacklog(projectId: string, sprintId: string): Promise<StructuredTaskData[]> {
        this.ensureProjectExists(projectId);
        if (!this.sprintRepository.findById(projectId, sprintId)) {
            throw new NotFoundError(`Sprint with ID ${sprintId} not found in project ${projectId}.`);
        }

        const sprintItems = this.taskRepository.findBySprintId(projectId, sprintId);
        const allTasks = this.taskRepository.findAllTasksForProject(projectId);
        const requiredIds = new Set(sprintItems.map(item => item.task_id));

        for (const item of sprintItems) {
            let currentParentId = item.parent_task_id ?? null;
            while (currentParentId) {
                const parent = allTasks.find(candidate => candidate.task_id === currentParentId);
                if (!parent) {
                    break;
                }
                requiredIds.add(parent.task_id);
                currentParentId = parent.parent_task_id ?? null;
            }
        }

        return this.structureTasks(allTasks.filter(item => requiredIds.has(item.task_id)), true);
    }

    private structureTasks(tasks: TaskData[], includeOrphansAsRoots: boolean): StructuredTaskData[] {
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

    private ensureProjectExists(projectId: string): void {
        if (!this.projectRepository.findById(projectId)) {
            throw new NotFoundError(`Project with ID ${projectId} not found.`);
        }
    }

    private ensureTasksExist(projectId: string, taskIds: string[]): void {
        const existenceCheck = this.taskRepository.checkTasksExist(projectId, taskIds);
        if (!existenceCheck.allExist) {
            throw new NotFoundError(`One or more tasks not found in project ${projectId}: ${existenceCheck.missingIds.join(', ')}`);
        }
    }

    private validateDependencies(projectId: string, taskId: string, dependencies?: string[]): void {
        if (dependencies === undefined || dependencies.length === 0) {
            return;
        }

        const depCheck = this.taskRepository.checkTasksExist(projectId, dependencies);
        if (!depCheck.allExist) {
            throw new ValidationError(`One or more dependency tasks not found in project ${projectId}: ${depCheck.missingIds.join(', ')}`);
        }

        if (dependencies.includes(taskId)) {
            throw new ValidationError(`Task ${taskId} cannot depend on itself.`);
        }
    }

    private validateWorkItemPlacement(
        projectId: string,
        itemType: WorkItemType,
        parentTaskId: string | null,
        sprintId: string | null,
        taskId?: string
    ): void {
        if (itemType === 'epic' && parentTaskId) {
            throw new ValidationError('Epics cannot have a parent task.');
        }

        if (itemType === 'epic' && sprintId) {
            throw new ValidationError('Epics cannot be assigned directly to a sprint.');
        }

        if ((itemType === 'story' || itemType === 'task') && parentTaskId) {
            if (taskId && parentTaskId === taskId) {
                throw new ValidationError(`Task ${taskId} cannot be its own parent.`);
            }

            const parentTask = this.taskRepository.findById(projectId, parentTaskId);
            if (!parentTask) {
                throw new ValidationError(`Parent task ${parentTaskId} was not found in project ${projectId}.`);
            }

            if (itemType === 'story' && parentTask.item_type !== 'epic') {
                throw new ValidationError('Stories can only be parented by epics.');
            }

            if (itemType === 'task' && parentTask.item_type === 'task') {
                throw new ValidationError('Tasks can only be parented by stories or epics.');
            }
        }

        if (sprintId && !this.sprintRepository.findById(projectId, sprintId)) {
            throw new ValidationError(`Sprint ${sprintId} was not found in project ${projectId}.`);
        }
    }
}
