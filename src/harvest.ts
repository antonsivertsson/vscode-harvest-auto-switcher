// Class for managing harvest interactions
import fetch from 'node-fetch';
import * as vscode from 'vscode';
import { NoTokenError } from './errors';

interface HarvestOptions {
  accessToken: string
  accountId: string
}

interface HarvestRequestOptions {
  method?: 'get' | 'post'
  headers?: {[key: string]: string}
}

namespace HarvestResponse {
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
  interface User { 
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
  export interface TimeEntries {
    time_entries: {
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
    }[]
  }
}

interface ProjectTasks {
  id: number
  name: string
  tasks: Task[]
}

interface Task {
  id: number
  name: string
}

class Harvest {
  private accessToken: string;
  private accountId: string;
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
    this.requestHeaders = {
      'Harvest-Account-ID': this.accountId,
      'Authorization': `Bearer ${this.accessToken}`,
    };

    this.fetch = (path: string, options?: HarvestRequestOptions) => {
      if (!this.accessToken || !this.accountId) {
        throw new NoTokenError("Access token not found");
      }
      return fetch(`${this.apiEndpoint}${path}`, {
        method: options?.method ?? 'get',
        headers: {
          ...this.requestHeaders,
          ...options?.headers
        },
      });
    };
  }

  async refreshProjectTasks() {
    try {
      const response = await this.fetch(this.paths.projectAssignments);
      const data = await response.json() as HarvestResponse.ProjectAssignments;
      console.log('Status: ', response.status);
      console.log(data);
      const tasksByProject = data.project_assignments
        .filter((proj) => proj.is_active)
        .map((projectAssignment) => ({
        id: projectAssignment.id,
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
    } catch (err) {
      if (err instanceof NoTokenError) {
        // FIXME: Let other part of code surface the error message
        vscode.window.showErrorMessage(err.message);
      }
    }
  }

  async getTimeEntries() {
    try {
      const response = await this.fetch(this.paths.timeEntries);
      const data = await response.json() as HarvestResponse.TimeEntries;
    } catch (err) {
      // FIXME: Implement
    }
  }

  /**
   * Returns the active time entry if there is one
   */
  getActiveTimeEntry() {

  }

  /**
   * Checks if the current credentials are valid by querying the Harvest API
   */
  async checkCredentials() {
    try {
      const response = await this.fetch(this.paths.credentialsCheck);
      const data = await response.json();
      return response.ok;
    } catch (err) {
      return false;
    }
  }
  
  /**
   * Updates the credentials if the user inputs new ones
   */
  async setCredentials(accessToken: string, accountId: string) {
    const oldAccessToken = this.accessToken;
    const oldAccountId = this.accountId;
    try {
      this.accessToken = accessToken;
      this.accountId = accountId;
      this.requestHeaders = {
        'Harvest-Account-ID': this.accountId,
        'Authorization': `Bearer ${this.accessToken}`,
      };
      await this.refreshProjectTasks();
    } catch (err) {
      // Reset to previous values
      this.accessToken = oldAccessToken;
      this.accountId = oldAccountId;
      this.requestHeaders = {
        'Harvest-Account-ID': oldAccountId,
        'Authorization': `Bearer ${oldAccessToken}`,
      };
      throw err;
    }
  }
}

export default Harvest;