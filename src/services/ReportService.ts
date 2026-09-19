import {
  ProjectRepository,
  ProjectData,
} from "../repositories/ProjectRepository.js";
import { TaskRepository, TaskData } from "../repositories/TaskRepository.js";
import {
  SprintData,
  SprintRepository,
} from "../repositories/SprintRepository.js";
import { TaskStatus } from "../types/taskTypes.js";
import { NotFoundError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

/**
 * Terminal task statuses considered "done" for progress computation.
 */
const TERMINAL_STATUSES: ReadonlySet<TaskStatus> = new Set<TaskStatus>([
  "done",
  "cancelled",
]);

const ALL_STATUSES: TaskStatus[] = [
  "todo",
  "in-progress",
  "review",
  "done",
  "cancelled",
];

export type StatusBreakdown = Record<TaskStatus, number>;

export interface ProgressSummary {
  total_items: number;
  total_tasks: number;
  done_tasks: number;
  open_tasks: number;
  progress_percent: number;
  by_status: StatusBreakdown;
}

export interface ReportTask extends TaskData {
  dependencies: string[];
  subtasks: ReportTask[];
  progress: ProgressSummary;
}

export interface MilestoneSummary {
  milestone: string;
  progress: ProgressSummary;
  sprint_count: number;
}

export interface ProjectOverview {
  project_id: string;
  name: string;
  created_at: string;
  progress: ProgressSummary;
  counts: {
    epics: number;
    stories: number;
    tasks: number;
    sprints: number;
    milestones: number;
  };
}

export interface ReportSprint extends SprintData {
  progress: ProgressSummary;
}

export interface ProjectDetail {
  project: ProjectData;
  progress: ProgressSummary;
  tree: ReportTask[];
  sprints: ReportSprint[];
  milestones: MilestoneSummary[];
}

/**
 * Aggregates project, task, sprint, and milestone data into JSON structures
 * suitable for a navigable web report. Read-only.
 */
export class ReportService {
  constructor(
    private projectRepository: ProjectRepository,
    private taskRepository: TaskRepository,
    private sprintRepository: SprintRepository
  ) {}

  /**
   * Computes a progress summary from a flat list of work items.
   * Progress percent is based on task-type items only (epics/stories are containers).
   */
  private computeProgress(items: TaskData[]): ProgressSummary {
    const byStatus: StatusBreakdown = {
      todo: 0,
      "in-progress": 0,
      review: 0,
      done: 0,
      cancelled: 0,
    };
    for (const item of items) {
      byStatus[item.status] += 1;
    }

    const tasks = items.filter((item) => item.item_type === "task");
    const doneTasks = tasks.filter((task) =>
      TERMINAL_STATUSES.has(task.status)
    ).length;

    return {
      total_items: items.length,
      total_tasks: tasks.length,
      done_tasks: doneTasks,
      open_tasks: tasks.length - doneTasks,
      progress_percent:
        tasks.length === 0 ? 0 : Math.round((doneTasks / tasks.length) * 100),
      by_status: byStatus,
    };
  }

  /**
   * Returns an overview of every project including aggregate progress and counts.
   */
  public async listProjectOverviews(): Promise<ProjectOverview[]> {
    const projects = this.projectRepository.findAll();
    return projects.map((project) => {
      const tasks = this.taskRepository.findAllTasksForProject(
        project.project_id
      );
      const sprints = this.sprintRepository.findAllForProject(
        project.project_id
      );
      const milestones = new Set<string>();
      for (const task of tasks) {
        if (task.milestone) {
          milestones.add(task.milestone);
        }
      }
      for (const sprint of sprints) {
        if (sprint.milestone) {
          milestones.add(sprint.milestone);
        }
      }

      return {
        project_id: project.project_id,
        name: project.name,
        created_at: project.created_at,
        progress: this.computeProgress(tasks),
        counts: {
          epics: tasks.filter((t) => t.item_type === "epic").length,
          stories: tasks.filter((t) => t.item_type === "story").length,
          tasks: tasks.filter((t) => t.item_type === "task").length,
          sprints: sprints.length,
          milestones: milestones.size,
        },
      };
    });
  }

  /**
   * Returns full detail for one project: nested work-item tree, sprints, and
   * milestone rollups, each with progress. Throws NotFoundError if missing.
   */
  public async getProjectDetail(projectId: string): Promise<ProjectDetail> {
    const project = this.projectRepository.findById(projectId);
    if (!project) {
      throw new NotFoundError(`Project with ID ${projectId} not found.`);
    }

    const allTasks = this.taskRepository.findAllTasksForProject(projectId);
    const allDependencies =
      this.taskRepository.findAllDependenciesForProject(projectId);
    const sprints = this.sprintRepository.findAllForProject(projectId);

    // Map dependencies by task.
    const dependencyMap = new Map<string, string[]>();
    for (const dep of allDependencies) {
      if (!dependencyMap.has(dep.task_id)) {
        dependencyMap.set(dep.task_id, []);
      }
      dependencyMap.get(dep.task_id)!.push(dep.depends_on_task_id);
    }

    // Build report nodes and parent/child relationships.
    const nodeMap = new Map<string, ReportTask>();
    for (const task of allTasks) {
      nodeMap.set(task.task_id, {
        ...task,
        dependencies: dependencyMap.get(task.task_id) ?? [],
        subtasks: [],
        // placeholder; replaced after tree is built
        progress: this.computeProgress([task]),
      });
    }

    const roots: ReportTask[] = [];
    for (const task of allTasks) {
      const node = nodeMap.get(task.task_id)!;
      if (task.parent_task_id && nodeMap.has(task.parent_task_id)) {
        nodeMap.get(task.parent_task_id)!.subtasks.push(node);
      } else {
        roots.push(node);
      }
    }

    // Compute progress for each node from itself + all descendants.
    const computeNodeProgress = (node: ReportTask): TaskData[] => {
      const collected: TaskData[] = [
        {
          task_id: node.task_id,
          project_id: node.project_id,
          parent_task_id: node.parent_task_id,
          sprint_id: node.sprint_id,
          milestone: node.milestone,
          item_type: node.item_type,
          description: node.description,
          status: node.status,
          priority: node.priority,
          created_at: node.created_at,
          updated_at: node.updated_at,
        },
      ];
      for (const child of node.subtasks) {
        collected.push(...computeNodeProgress(child));
      }
      node.progress = this.computeProgress(collected);
      return collected;
    };
    for (const root of roots) {
      computeNodeProgress(root);
    }

    // Sprint progress (based on items assigned to each sprint).
    const reportSprints: ReportSprint[] = sprints.map((sprint) => {
      const sprintItems = allTasks.filter(
        (task) => task.sprint_id === sprint.sprint_id
      );
      return { ...sprint, progress: this.computeProgress(sprintItems) };
    });

    // Milestone rollups (tasks tagged with a milestone + sprints tagged with it).
    const milestoneNames = new Set<string>();
    for (const task of allTasks) {
      if (task.milestone) {
        milestoneNames.add(task.milestone);
      }
    }
    for (const sprint of sprints) {
      if (sprint.milestone) {
        milestoneNames.add(sprint.milestone);
      }
    }
    const milestones: MilestoneSummary[] = Array.from(milestoneNames)
      .sort((a, b) => a.localeCompare(b))
      .map((milestone) => {
        const milestoneItems = allTasks.filter(
          (task) => task.milestone === milestone
        );
        const sprintCount = sprints.filter(
          (sprint) => sprint.milestone === milestone
        ).length;
        return {
          milestone,
          progress: this.computeProgress(milestoneItems),
          sprint_count: sprintCount,
        };
      });

    logger.debug(
      `[ReportService] Built detail for project ${projectId}: ${roots.length} root items, ${reportSprints.length} sprints, ${milestones.length} milestones.`
    );

    return {
      project,
      progress: this.computeProgress(allTasks),
      tree: roots,
      sprints: reportSprints,
      milestones,
    };
  }

  /**
   * Exposes the list of valid statuses for the UI legend.
   */
  public getStatuses(): TaskStatus[] {
    return [...ALL_STATUSES];
  }
}
