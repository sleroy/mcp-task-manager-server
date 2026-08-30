import { v4 as uuidv4 } from 'uuid';
import { ProjectRepository } from '../repositories/ProjectRepository.js';
import { SprintData, SprintRepository } from '../repositories/SprintRepository.js';
import { SprintStatus } from '../types/taskTypes.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';

export interface CreateSprintInput {
    project_id: string;
    name: string;
    goal?: string | null;
    description?: string | null;
    milestone?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    status?: SprintStatus;
}

export interface ListSprintsOptions {
    project_id: string;
    status?: SprintStatus;
    milestone?: string | null;
}

export class SprintService {
    constructor(
        private sprintRepository: SprintRepository,
        private projectRepository: ProjectRepository
    ) {}

    public async createSprint(input: CreateSprintInput): Promise<SprintData> {
        this.ensureProjectExists(input.project_id);
        this.validateDateRange(input.start_date ?? null, input.end_date ?? null);

        const now = new Date().toISOString();
        const sprint: SprintData = {
            sprint_id: uuidv4(),
            project_id: input.project_id,
            name: input.name,
            goal: input.goal ?? input.description ?? null,
            milestone: input.milestone ?? null,
            start_date: input.start_date ?? null,
            end_date: input.end_date ?? null,
            status: input.status ?? 'planned',
            created_at: now,
            updated_at: now,
        };

        this.sprintRepository.create(sprint);
        return sprint;
    }

    public async listSprints(options: ListSprintsOptions): Promise<SprintData[]> {
        this.ensureProjectExists(options.project_id);
        return this.sprintRepository.findByProjectId(options.project_id, options.status, options.milestone);
    }

    public async updateSprint(input: {
        project_id: string;
        sprint_id: string;
        name?: string;
        goal?: string | null;
        description?: string | null;
        milestone?: string | null;
        start_date?: string | null;
        end_date?: string | null;
        status?: SprintStatus;
    }): Promise<SprintData> {
        if (
            input.name === undefined &&
            input.goal === undefined &&
            input.description === undefined &&
            input.milestone === undefined &&
            input.start_date === undefined &&
            input.end_date === undefined &&
            input.status === undefined
        ) {
            throw new ValidationError('At least one field (name, goal, description, milestone, start_date, end_date, or status) must be provided.');
        }
        this.ensureProjectExists(input.project_id);
        this.ensureSprintExists(input.project_id, input.sprint_id);
        this.validateDateRange(input.start_date ?? null, input.end_date ?? null);

        const goalUpdate = input.goal !== undefined ? input.goal : input.description;
        return this.sprintRepository.updateSprint(input.project_id, input.sprint_id, {
            name: input.name,
            goal: goalUpdate,
            milestone: input.milestone,
            start_date: input.start_date,
            end_date: input.end_date,
            status: input.status,
        }, new Date().toISOString());
    }

    public async startSprint(projectId: string, sprintId: string, makeExclusive = true): Promise<{ sprint: SprintData; deactivated_sprint_count: number }> {
        this.ensureProjectExists(projectId);
        this.ensureSprintExists(projectId, sprintId);

        const now = new Date().toISOString();
        let deactivatedSprintCount = 0;
        if (makeExclusive) {
            deactivatedSprintCount = this.sprintRepository.markOtherActiveSprintsPlanned(projectId, sprintId, now);
        }
        const sprint = this.sprintRepository.updateStatus(projectId, sprintId, 'active', now);
        return { sprint, deactivated_sprint_count: deactivatedSprintCount };
    }

    private ensureProjectExists(projectId: string): void {
        if (!this.projectRepository.findById(projectId)) {
            throw new NotFoundError(`Project with ID ${projectId} not found.`);
        }
    }

    private ensureSprintExists(projectId: string, sprintId: string): void {
        if (!this.sprintRepository.findById(projectId, sprintId)) {
            throw new NotFoundError(`Sprint with ID ${sprintId} not found in project ${projectId}.`);
        }
    }

    private validateDateRange(startDate: string | null, endDate: string | null): void {
        if (startDate && endDate && startDate > endDate) {
            throw new ValidationError('Sprint start_date cannot be after end_date.');
        }
    }
}
