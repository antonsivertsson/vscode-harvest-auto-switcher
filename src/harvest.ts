// Class for managing harvest interactions
import fetch, { RequestInit } from 'node-fetch';
import { NoTokenError } from './errors';

interface HarvestOptions {
  accessToken: string
  accountId: string
  userId: number
}

export namespace HarvestResponse {
  interface Project {
    id: number
    name: string
    code: string
    created_at: string
    updated_at: string
  }
  interface TaskAssignment {
    id: number
    is_active: boolean
    created_at: string
    updated_at: string
  }
  interface Task {
    id: number
    name: string
  }
  interface Client {
    id: number
    name: string
  }
  export interface User { 
    id: number
    name: string
  }
  export interface ProjectAssignments {
    project_assignments: {
      id: number
      is_active: boolean
      project: Project
      client: Client
      task_assignments: (TaskAssignment & { task: Task })[]
    }[]
  }

  export interface TimeEntry {
    id: number
    spent_date: string // e.g. "2017-03-02"
    hours: number
    hours_without_timer: number
    rounded_hours: number
    notes: string
    created_at: string
    updated_at: string
    is_locked: boolean
    locked_reason: string // TODO: Add the relevant kinds of reasons?
    is_closed: boolean
    timer_started_at: string | null
    is_running: boolean
    user: User
    client: Client
    project: Project
    task: Task
    task_assignment: TaskAssignment
  }

  export interface TimeEntries {
    time_entries: TimeEntry[]
  }
}

export interface ProjectTasks {
  id: number
  name: string
  code: string
  tasks: Task[]
}

interface Task {
  id: number
  name: string
}

class Harvest {
  private accessToken: string;
  private accountId: string;
  private userId = -1;
  private readonly apiEndpoint = 'https://api.harvestapp.com/api/v2';
  private paths = {
    projectAssignments: '/users/me/project_assignments',
    timeEntries: '/time_entries',
    credentialsCheck: '/users/me'
  };
  private requestHeaders;
  private readonly fetch;
  
  public projectTasks: ProjectTasks[] = [];

  constructor(options: HarvestOptions) {
    this.accessToken = options.accessToken;
    this.accountId = options.accountId;
    this.userId = options.userId;
    this.requestHeaders = {
      'Harvest-Account-ID': this.accountId,
      'Authorization': `Bearer ${this.accessToken}`,
    };

    this.fetch = (path: string, options?: RequestInit) => {
      if (!this.accessToken || !this.accountId) {
        throw new NoTokenError("Access token not found");
      }
      return fetch(`${this.apiEndpoint}${path}`, {
        ...options,
        headers: {
          ...this.requestHeaders,
          ...options?.headers
        },
      });
    };
  }

  /**
   * Initializing function to fetch data from harvest
   */
  async init() {
    if (this.accessToken && this.accountId && this.userId > -1) {
      const [activeTimeEntry] = await Promise.all([this.getActiveTimeEntry(), this.refreshProjectTasks()]);
      return activeTimeEntry;
    }
  }

  async refreshProjectTasks() {
    // Returns only active projects by default
    const response = await this.fetch(this.paths.projectAssignments);
    const data = await response.json() as HarvestResponse.ProjectAssignments;
    const tasksByProject = data.project_assignments
      .map((projectAssignment) => ({
        id: projectAssignment.project.id,
        code: projectAssignment.project.code,
        name: projectAssignment.project.name,
        tasks: projectAssignment.task_assignments
          .filter((taskAssign) => taskAssign.is_active)
          .map((taskAssignment) => ({
            id: taskAssignment.task.id,
            name: taskAssignment.task.name,
          }))
      }));
    this.projectTasks = tasksByProject;
    return;
  }

  async getTimeEntries() {
    try {
      const todayISO = new Date().toISOString().split('T')[0];
      const response = await this.fetch(`/time_entries?user_id=${this.userId}&from=${todayISO}&to=${todayISO}`);
      const data = await response.json() as HarvestResponse.TimeEntries;
      return data;
    } catch (err) {
      // FIXME: Implement
      throw err;
    }
  }

  /**
   * Returns the active time entry if there is one
   */
  async getActiveTimeEntry() {
    try {
      const response = await this.fetch(`/time_entries?is_running=true&user_id=${this.userId}`);
      const data = await response.json() as HarvestResponse.TimeEntries;
      if (data.time_entries.length > 1) {
        // FIXME: If multiple entries, send error message to user with option to automatically stop one?
        throw new Error("More than 1 timer currently running");
      } else if (data.time_entries.length === 0) {
        return null;
      }
      return data.time_entries[0];
    } catch (err) {
      throw err;
    }
  }

  /**
   * Stops a time entry for the id if it's running
   * @param entryId 
   */
  async stopEntry(entryId: number) {
    await this.fetch(`/time_entries/${entryId}/stop`, { method: 'patch' });
  }

  /**
   * Restarts a pre-existing time entry for the id if not already running
   * @param entryId 
   */
  async startEntry(entryId: number) {
    await this.fetch(`/time_entries/${entryId}/restart`, { method: 'patch' });
  }

  async updateEntryNotes(entryId: number, notes: string) {
    await this.fetch(`/time_entries/${entryId}`, {
      method: 'patch',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        notes
      })
    });
  }

  /**
   * Creates a new time entry against project and task
   * Will automatically start this and stop any previously running entries
   * @param projectId 
   * @param taskId 
   * @returns a promise with the id for the new entry
   */
  async addNewEntry(projectId: number, taskId: number, notes?: string) {
    const response = await this.fetch(this.paths.timeEntries, {
      method: 'post',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        project_id: projectId,
        task_id: taskId,
        spent_date: new Date().toISOString().split('T')[0],
        notes,
      })
    });
    const data = await response.json() as HarvestResponse.TimeEntry;
    return data;
  }

  async getUser() {
    const response = await this.fetch('/users/me');
    const data = await response.json() as HarvestResponse.User;
    return data;
  }
  
  /**
   * Updates the credentials if the user inputs new ones
   */
  async setCredentials(accessToken: string, accountId: string) {
    const oldAccessToken = this.accessToken;
    const oldAccountId = this.accountId;
    const oldUserId = this.userId;
    try {
      this.accessToken = accessToken;
      this.accountId = accountId;
      this.requestHeaders = {
        'Harvest-Account-ID': this.accountId,
        'Authorization': `Bearer ${this.accessToken}`,
      };
      const [user] = await Promise.all([this.getUser(), this.refreshProjectTasks()]);
      this.userId = user.id;
      return {
        accessToken,
        accountId,
        userId: this.userId
      };
    } catch (err) {
      // Reset to previous values
      this.accessToken = oldAccessToken;
      this.accountId = oldAccountId;
      this.userId = oldUserId;
      this.requestHeaders = {
        'Harvest-Account-ID': oldAccountId,
        'Authorization': `Bearer ${oldAccessToken}`,
      };
      throw err;
    }
  }
}

export default Harvest;