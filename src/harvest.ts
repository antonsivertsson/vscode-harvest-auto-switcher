// Class for managing harvest interactions
import fetch, { RequestInit } from 'node-fetch';
import { NoTokenError } from './errors';
import { harvestProjectsToProjectInfo } from './utils';
import { constants } from './constants';

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
  private requestHeaders;
  private readonly fetch;
  private runningMutations: Map<string, number>;
  
  public projectTasks: ProjectTasks[] = [];

  constructor(options: HarvestOptions) {
    this.accessToken = options.accessToken;
    this.accountId = options.accountId;
    this.userId = options.userId;
    this.runningMutations = new Map();
    this.requestHeaders = () => ({
      'Harvest-Account-ID': this.accountId,
      'Authorization': `Bearer ${this.accessToken}`,
    });

    this.fetch = (path: string, options?: RequestInit) => {
      if (!this.accessToken || !this.accountId) {
        throw new NoTokenError("Access token not found");
      }
      return fetch(`${this.apiEndpoint}${path}`, {
        ...options,
        headers: {
          ...this.requestHeaders(),
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
      const [activeTimeEntry] = await Promise.all([this.get.activeTimeEntry(), this.refreshProjectTasks()]);
      return activeTimeEntry;
    }
  }

  async refreshProjectTasks() {
    // Returns only active projects by default
    const projectAssignments = await this.get.projectAssignments();
    this.projectTasks = harvestProjectsToProjectInfo(projectAssignments);
  }

  public create = ({
    /**
     * Creates a new time entry against project and task
     * Will automatically start this and stop any previously running entries
     * @param projectId 
     * @param taskId 
     * @returns a promise with the id for the new entry
     */
    newEntry: async (projectId: number, taskId: number, notes?: string) => {
      const action = 'newEntry';
      const mutationKey = `${action}_${projectId}_${taskId}`;
      const mutationStarted = this.runningMutations.get(mutationKey);
      if (mutationStarted && mutationStarted + constants.MUTATION_TIMEOUT > Date.now()) {
        // TODO: handled Error or?
        return;
      }
      this.runningMutations.set(mutationKey, Date.now());
      const response = await this.fetch('/time_entries', {
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
      if (!response.ok) {
        throw new Error('Failed to create new entry');
      }
      const data = await response.json() as HarvestResponse.TimeEntry;
      this.runningMutations.delete(mutationKey);
      return data;
    }
  });

  public update = ({
    /**
     * Resumes a pre-existing time entry for the id if not already running
     * @param entryId 
     */
    startEntry: async (entryId: number) => {
      const action = 'startEntry';
      const mutationKey = `${action}_${entryId}`;
      const mutationStarted = this.runningMutations.get(mutationKey);
      if (mutationStarted !== undefined && mutationStarted + constants.MUTATION_TIMEOUT > Date.now()) {
        // TODO: handled Error or?
        return;
      }
      this.runningMutations.set(mutationKey, Date.now());
      const res = await this.fetch(`/time_entries/${entryId}/restart`, { method: 'patch' });
      if (!res.ok) {
        // FIXME: Needs better error handling
        throw new Error('Failed to start timer');
      }
      this.runningMutations.delete(mutationKey);
    },
    /**
     * Stops a pre-existing time entry if it's running
     * @param entryId 
     */
    stopEntry: async (entryId: number) => {
      const action = 'stopEntry';
      const mutationKey = `${action}_${entryId}`;
      const mutationStarted = this.runningMutations.get(mutationKey);
      if (mutationStarted && mutationStarted + constants.MUTATION_TIMEOUT > Date.now()) {
        // TODO: handled Error or?
        return;
      }
      this.runningMutations.set(mutationKey, Date.now());
      const res = await this.fetch(`/time_entries/${entryId}/stop`, { method: 'patch' });
      if (!res.ok) {
        // FIXME: Needs better error handling
        throw new Error('Failed to stop timer');
      }
      this.runningMutations.delete(mutationKey);
    },

    /**
     * Updates the notes attached to a time entry
     */
    notes: async (entryId: number, updatedNotes: string) => {
      const action = 'updateNotes';
      const mutationKey = `${action}_${entryId}_${updatedNotes}`;
      const mutationStarted = this.runningMutations.get(mutationKey);
      if (mutationStarted && mutationStarted + constants.MUTATION_TIMEOUT > Date.now()) {
        // TODO: handled Error or?
        return;
      }
      this.runningMutations.set(mutationKey, Date.now());
      const res = await this.fetch(`/time_entries/${entryId}`, {
        method: 'patch',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          notes: updatedNotes
        })
      });
      if (!res.ok) {
        // FIXME: Needs better error handling
        throw new Error('Failed to update notes');
      }
      this.runningMutations.delete(mutationKey);
    },
  });

  public get = ({
    /**
     * Retrieves user information for authenticated user
     * @returns Harvest user data
     */
    user: async () => {
      const response = await this.fetch('/users/me');
      if (!response.ok) {
        throw new Error(`Failed to get user. Status: ${response.statusText}`);
      }
      const data = await response.json() as HarvestResponse.User;
      return data;
    },

    /**
     * Retrieves all time entries for this date
     * @returns Today's entries
     */
    timeEntries: async () => {
      try {
        const todayISO = new Date().toISOString().split('T')[0];
        const response = await this.fetch(`/time_entries?user_id=${this.userId}&from=${todayISO}&to=${todayISO}`);
        const data = await response.json() as HarvestResponse.TimeEntries;
        return data;
      } catch (err) {
        // FIXME: Implement
        throw err;
      }
    },

    /**
     * Returns the active time entry if there is one
     */
    activeTimeEntry: async () => {
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
    },

    /**
     * Retrieves project assignments for authenticated user.
     * @returns Project assignment object
     */
    projectAssignments: async () => {
      const response = await this.fetch('/users/me/project_assignments');
      const data = await response.json() as HarvestResponse.ProjectAssignments;
      return data;
    }
  });
  

  /**
   * Updates Harvest credentials.
   * Reverts to previous values if it fails to retrieve information from Harvest.
   * @param accessToken generated access token from https://id.getharvest.com/developers
   * @param accountId Harvest account ID retrieved from https://id.getharvest.com/developers
   * @returns 
   */
  public async setCredentials(accessToken: string, accountId: string) {
    const oldAccessToken = this.accessToken;
    const oldAccountId = this.accountId;
    const oldUserId = this.userId;
    try {
      this.accessToken = accessToken;
      this.accountId = accountId;
      const [user] = await Promise.all([this.get.user(), this.refreshProjectTasks()]);
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
      throw err;
    }
  }
}

export default Harvest;