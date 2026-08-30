import { Database as Db } from 'better-sqlite3';
import { SprintStatus } from '../types/taskTypes.js';
import { logger } from '../utils/logger.js';

export interface SprintData {
    sprint_id: string;
    project_id: string;
    name: string;
    goal: string | null;
    start_date: string | null;
    end_date: string | null;
    status: SprintStatus;
    created_at: string;
    updated_at: string;
}

export class SprintRepository {
    private db: Db;

    constructor(db: Db) {
        this.db = db;
    }

    public create(sprint: SprintData): void {
        const sql = `
            INSERT INTO sprints (
                sprint_id, project_id, name, goal, start_date, end_date,
                status, created_at, updated_at
            ) VALUES (
                @sprint_id, @project_id, @name, @goal, @start_date, @end_date,
                @status, @created_at, @updated_at
            )
        `;
        try {
            const info = this.db.prepare(sql).run(sprint);
            logger.info(`[SprintRepository] Created sprint ${sprint.sprint_id}, changes: ${info.changes}`);
        } catch (error) {
            logger.error(`[SprintRepository] Failed to create sprint ${sprint.sprint_id}:`, error);
            throw error;
        }
    }

    public findById(projectId: string, sprintId: string): SprintData | undefined {
        const sql = `
            SELECT sprint_id, project_id, name, goal, start_date, end_date, status, created_at, updated_at
            FROM sprints
            WHERE project_id = ? AND sprint_id = ?
        `;
        try {
            return this.db.prepare(sql).get(projectId, sprintId) as SprintData | undefined;
        } catch (error) {
            logger.error(`[SprintRepository] Failed to find sprint ${sprintId} in project ${projectId}:`, error);
            throw error;
        }
    }

    public findByProjectId(projectId: string, status?: SprintStatus): SprintData[] {
        let sql = `
            SELECT sprint_id, project_id, name, goal, start_date, end_date, status, created_at, updated_at
            FROM sprints
            WHERE project_id = ?
        `;
        const params: string[] = [projectId];
        if (status) {
            sql += ' AND status = ?';
            params.push(status);
        }
        sql += ' ORDER BY start_date IS NULL ASC, start_date ASC, created_at ASC';

        try {
            const sprints = this.db.prepare(sql).all(...params) as SprintData[];
            logger.debug(`[SprintRepository] Found ${sprints.length} sprints for project ${projectId}`);
            return sprints;
        } catch (error) {
            logger.error(`[SprintRepository] Failed to list sprints for project ${projectId}:`, error);
            throw error;
        }
    }

    public findAllForProject(projectId: string): SprintData[] {
        return this.findByProjectId(projectId);
    }

    public findMostRecentActive(projectId: string): SprintData | undefined {
        const sql = `
            SELECT sprint_id, project_id, name, goal, start_date, end_date, status, created_at, updated_at
            FROM sprints
            WHERE project_id = ? AND status = 'active'
            ORDER BY start_date IS NULL ASC, start_date DESC, created_at DESC
            LIMIT 1
        `;
        try {
            return this.db.prepare(sql).get(projectId) as SprintData | undefined;
        } catch (error) {
            logger.error(`[SprintRepository] Failed to find active sprint for project ${projectId}:`, error);
            throw error;
        }
    }

    public updateStatus(projectId: string, sprintId: string, status: SprintStatus, timestamp: string): SprintData {
        const sql = `
            UPDATE sprints
            SET status = ?, updated_at = ?
            WHERE project_id = ? AND sprint_id = ?
        `;
        try {
            const info = this.db.prepare(sql).run(status, timestamp, projectId, sprintId);
            if (info.changes !== 1) {
                throw new Error(`Sprint ${sprintId} not found in project ${projectId}.`);
            }
            const updated = this.findById(projectId, sprintId);
            if (!updated) {
                throw new Error(`Failed to retrieve sprint ${sprintId} after status update.`);
            }
            return updated;
        } catch (error) {
            logger.error(`[SprintRepository] Failed to update sprint ${sprintId} status:`, error);
            throw error;
        }
    }

    public updateSprint(
        projectId: string,
        sprintId: string,
        updates: {
            name?: string;
            goal?: string | null;
            start_date?: string | null;
            end_date?: string | null;
            status?: SprintStatus;
        },
        timestamp: string
    ): SprintData {
        const setClauses: string[] = [];
        const params: (string | null)[] = [];

        if (updates.name !== undefined) {
            setClauses.push('name = ?');
            params.push(updates.name);
        }
        if (updates.goal !== undefined) {
            setClauses.push('goal = ?');
            params.push(updates.goal);
        }
        if (updates.start_date !== undefined) {
            setClauses.push('start_date = ?');
            params.push(updates.start_date);
        }
        if (updates.end_date !== undefined) {
            setClauses.push('end_date = ?');
            params.push(updates.end_date);
        }
        if (updates.status !== undefined) {
            setClauses.push('status = ?');
            params.push(updates.status);
        }

        setClauses.push('updated_at = ?');
        params.push(timestamp, projectId, sprintId);

        const sql = `
            UPDATE sprints
            SET ${setClauses.join(', ')}
            WHERE project_id = ? AND sprint_id = ?
        `;
        try {
            const info = this.db.prepare(sql).run(...params);
            if (info.changes !== 1) {
                throw new Error(`Sprint ${sprintId} not found in project ${projectId}.`);
            }
            const updated = this.findById(projectId, sprintId);
            if (!updated) {
                throw new Error(`Failed to retrieve sprint ${sprintId} after update.`);
            }
            return updated;
        } catch (error) {
            logger.error(`[SprintRepository] Failed to update sprint ${sprintId}:`, error);
            throw error;
        }
    }

    public markOtherActiveSprintsPlanned(projectId: string, activeSprintId: string, timestamp: string): number {
        const sql = `
            UPDATE sprints
            SET status = 'planned', updated_at = ?
            WHERE project_id = ? AND sprint_id != ? AND status = 'active'
        `;
        try {
            const info = this.db.prepare(sql).run(timestamp, projectId, activeSprintId);
            return info.changes;
        } catch (error) {
            logger.error(`[SprintRepository] Failed to mark other active sprints planned for project ${projectId}:`, error);
            throw error;
        }
    }
}
