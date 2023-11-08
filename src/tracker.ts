import * as vscode from 'vscode';

import Store from './store';
import { constants } from './constants';
import Harvest from './harvest';
  
/**
 * Keeps track of changes in vscode to determine when to trigger Harvest updates
 */
class Tracker {
  private store: Store;
  /** Harvest Task ID. Used to determine if we've switched to an editor belonging to a different task */
  /** The last active Harvest Entry */
  public lastActiveEntry = {
    projectName: '',
    projectCode: '',
    taskName: '',
    taskId: -1,
    entryId: -1,
    hours: 0,
  };
  private harvest: Harvest;
  private statusBar: vscode.StatusBarItem;
  public lastViewedFile = '';
  public activeTimer = false;
  private updateTrackingStateInterval: NodeJS.Timeout | null;
  private harvestTrackingCheckInterval: NodeJS.Timeout | null;

  private showingSwitchStartNotification = false;

  constructor(store: Store, statusBar: vscode.StatusBarItem, harvestController: Harvest) {
    this.store = store;
    this.harvest = harvestController;
    this.statusBar = statusBar;
    this.updateTrackingStateInterval = null;

    this.harvestTrackingCheckInterval = setInterval(async () => {
      // Periodically check if harvest has accepted any external changes to
      // time tracking that we are not aware of
      const activeEntry = await this.harvest.get.activeTimeEntry();
      if (!activeEntry) {
        // Stop tracking if external harvest isn't currently tracking
        this.activeTimer = false;
        this.stopTracking();
        this.updateStatusBar();
      } else if (activeEntry && activeEntry.id !== this.lastActiveEntry.entryId) {
        // If harvest is tracking another task, update our task
        this.lastActiveEntry = {
          projectName: activeEntry.project.name,
          projectCode: activeEntry.project.code,
          taskName: activeEntry.task.name,
          taskId: activeEntry.task.id,
          entryId: activeEntry.id,
          hours: activeEntry.hours,
        };
        this.activeTimer = true;
        this.startTracking();
        this.updateStatusBar();
      }
    }, constants.CHECK_TRACKING_STATUS_INTERVAL_MS);
  }
  
  /**
   * Converts float of hours into text of format hh:mm
   * @param hours 
   */
  public static hoursToText(hours: number) {
    const h = Math.floor(hours);
    let min = (Math.round((hours - h) * 60)).toString();
    return `${h < 10 ? `0${h}` : h}:${min.length < 2 ? `0${min}` : min}`;
  }

  /**
   * Takes a number of minutes and converts it into a float where 1 = 1 hour.
   * E.g. 15 mins = 0.25 hours.
   * @param mins 
   */
  public static minsToHourFloat(mins: number) {
    return mins / 60;
  }

  /**
   * Returns the associated task for a file if available
   * @param fileName
   * @returns 
   */
  public getAssociatedTask(fileName: string) {
    return this.store.getAssociatedTaskForFile(fileName);
  }

  /**
   * Updates the status bar given the status of time tracking
   */
  public updateStatusBar() {
    // FIXME: If currently tracking an entry and the project code or name
    let statusBarText = '$(harvest-auto-timer-running)';
    let tooltipText = '';
    if (this.store.getSwitching()) {
      statusBarText += ' $(harvest-auto-switch)';
    }
    if (this.activeTimer) {
      this.statusBar.color = new vscode.ThemeColor('statusBar.debuggingForeground');
    } else {
      this.statusBar.color = new vscode.ThemeColor('statusBar.foreground');
    }
    // FIXME: add configurable to settings
    if (this.lastActiveEntry.entryId === -1) {
      statusBarText += ' Start';
      tooltipText += 'Start a new task';
      this.statusBar.command = 'vscode-harvest-auto-switcher.startEntry';
    } else {
      if (this.lastActiveEntry.projectCode !== '') {
        statusBarText += ` ${this.lastActiveEntry.projectCode} -`;
      }
      if (this.lastActiveEntry.taskName !== '') {
        statusBarText += ` ${this.lastActiveEntry.taskName}`;
      }
      tooltipText += `${this.lastActiveEntry.projectName}
      ${this.lastActiveEntry.taskName}`;
      statusBarText += ` ${Tracker.hoursToText(this.lastActiveEntry.hours)}`;
      this.statusBar.command = 'vscode-harvest-auto-switcher.toggleSwitching';
    }

    this.statusBar.tooltip = tooltipText;
    this.statusBar.text = statusBarText;
  }

  /**
   * Enables switching functionality
   */
  public enableSwitching() {
    this.store.setSwitching(true);
  }

  /**
   * Disables switching functionality
   */
  public disableSwitching() {
    this.store.setSwitching(false);
  }

  /**
   * Starts an interval that increases the hours on the active entry
   * and renders the result in the status bar.
   */
  public startTracking() {
    if (this.updateTrackingStateInterval === null) {
      this.updateTrackingStateInterval = setInterval(() => {
        this.lastActiveEntry.hours += Tracker.minsToHourFloat(1);
        this.updateStatusBar();
      }, constants.TRACKING_INTERVAL_MS);
    }
  }

  /**
   * Stops tracking time for entry (e.g. when a user pauses tracking)
   * and renders the result in the status bar.
   */
  public stopTracking() {
    this.activeTimer = false;
    if (this.updateTrackingStateInterval) {
      clearInterval(this.updateTrackingStateInterval);
      this.updateTrackingStateInterval = null;
    }
  }

  /**
   * Triggered when any text document is changed (regardless of whether or not it's saved)
   * If switching is turned ON:
   * - Check if there's an associated task for the file we're editing
   * - If we're tracking an entry -> change entry if associated task is different than active task
   * - If we're not tracking an entry -> Notify user that they may want to start tracking
   * @param event 
   * @returns 
   */
  public async onTextDocumentChange(event: vscode.TextDocumentChangeEvent) {
    const { document } = event;
    if (document.isUntitled || !this.store.getSwitching()) {
      return;
    }
    const { fileName } = document;
    // Check if edited file has an associated task
    const associatedTask = this.store.getAssociatedTaskForFile(fileName);
    const currentlyTracking = this.activeTimer;
    if (!associatedTask) {
      // FIXME: if there's no associated task, we don't do anything (ALT. we track focus)
      return;
    }
    if (currentlyTracking && associatedTask.task.id > 0 && associatedTask.task.id !== this.lastActiveEntry.taskId) {
      // Check harvest for an entry
      const todaysEntries = (await this.harvest.get.timeEntries()).time_entries;
      // FIXME: Add functionality to return the last used entry for this task?
      const activeEntryForNextTask = todaysEntries.find((entry) => entry.task.id === associatedTask.task.id);
      if (activeEntryForNextTask) {
        await this.harvest.update.startEntry(activeEntryForNextTask.id);
        this.lastActiveEntry = {
          projectName: activeEntryForNextTask.project.name,
          projectCode: activeEntryForNextTask.project.code,
          taskName: activeEntryForNextTask.task.name,
          taskId: activeEntryForNextTask.task.id,
          entryId: activeEntryForNextTask.id,
          hours: activeEntryForNextTask.hours,
        };
      } else {
        const newEntry = await this.harvest.create.newEntry(associatedTask.project.id, associatedTask.task.id);
        this.lastActiveEntry = {
          projectName: newEntry.project.name,
          projectCode: newEntry.project.code,
          taskName: newEntry.task.name,
          taskId: newEntry.task.id,
          entryId: newEntry.id,
          hours: newEntry.hours,
        };
      }
      this.activeTimer = true;
      this.updateStatusBar();
    }
    /*
    else if (this.store.getShowSwitchStartNotification() && !currentlyTracking && !this.showingSwitchStartNotification) {
      // If not currently tracking, but there is an associated task, notify user
      const actions = ['Yes', 'Yes, as new task', `Don't show this again`];
      const selectedAction = await vscode.window.showInformationMessage(`Your timesheet is not running, would you like to start it?\nDefault task: ${associatedTask.project.name} - ${associatedTask.task.name}`, ...actions);
      switch (selectedAction) {
        case 'Yes':
          await this.harvest.addNewEntry(associatedTask.project.id, associatedTask.task.id);
          break;
        case 'Yes, but for another task':
          await vscode.commands.executeCommand('vscode-harvest-auto-switcher.startEntry');
          break;
        case `Don't show this again`:
          this.store.setShowSwitchStartNotification(false);
          break;
      }
    }
    */
    // clearTimeout(this.idleTracker);
    // this.idleTracker = setTimeout(() => {
    //   // Save information on 
    // }, constants.IDLE_TIME_MS);
  }

  public async onTextDocumentSave(event: vscode.TextDocument) {
    if (event.isDirty || event.isUntitled) {
      return;
    }
    const { fileName } = event;
    const associatedTask = this.store.getAssociatedTaskForFile(fileName);
    if (!associatedTask) {
      return;
    }
    const currentlyTracking = this.activeTimer;
    if (!currentlyTracking
      && this.store.getShowSwitchStartNotification()
      && !this.showingSwitchStartNotification) {
      // If not currently tracking, but there is an associated task, notify user
      const actions = ['Yes', 'Yes, as new task', `Don't show this again`];
      const selectedAction = await vscode.window.showInformationMessage(`Your timesheet is not running, would you like to start it?\nDefault task: ${associatedTask.project.name} - ${associatedTask.task.name}`, ...actions);
      switch (selectedAction) {
        case 'Yes':
          // Find an existing entry
          const todaysEntries = (await this.harvest.get.timeEntries()).time_entries;
          const activeEntryForNextTask = todaysEntries.find((entry) => entry.task.id === associatedTask.task.id);
          if (activeEntryForNextTask) {
            await this.harvest.update.startEntry(activeEntryForNextTask.id);
            this.lastActiveEntry = {
              projectName: activeEntryForNextTask.project.name,
              projectCode: activeEntryForNextTask.project.code,
              taskName: activeEntryForNextTask.task.name,
              taskId: activeEntryForNextTask.task.id,
              entryId: activeEntryForNextTask.id,
              hours: activeEntryForNextTask.hours,
            };
          } else {
            const newEntry = await this.harvest.create.newEntry(associatedTask.project.id, associatedTask.task.id);
            this.lastActiveEntry = {
              projectName: newEntry.project.name,
              projectCode: newEntry.project.code,
              taskName: newEntry.task.name,
              taskId: newEntry.task.id,
              entryId: newEntry.id,
              hours: newEntry.hours,
            };
          }
          this.activeTimer = true;
          this.updateStatusBar();
          break;
        case 'Yes, as new task':
          await vscode.commands.executeCommand('vscode-harvest-auto-switcher.startEntry');
          break;
        case `Don't show this again`:
          this.store.setShowSwitchStartNotification(false);
          break;
      }
    }
  }

    /**
   * Triggered when on user navigating to new view. Should be triggered when commands to update default
   * tasks are performed
   * @param event
   * @returns 
   */
  public activeEditorChanged(event: vscode.TextEditor | undefined) {
    // TODO: See if there are other allowed uri schemes that should be allowed
    if (!this.store.getSwitching() || event === undefined || event.document.uri.scheme !== 'file') {
      return;
    }
    const { fileName } = event.document;
    this.lastViewedFile = fileName; // Set the last viewed file

    // TODO: Remove everything below???

    /*
    const associatedTask = this.store.getAssociatedTaskForFile(fileName);
    if (associatedTask && associatedTask.task.id !== this.activeEntry.taskId) {
      this.timoutHandle = setTimeout(() => {
        // Trigger Harvest change
        vscode.window.showInformationMessage(`Was: ${this.activeEntry.taskId}, is now: ${associatedTask}`);
      }, this.threshold);
    } else if (this.timoutHandle) {
      clearTimeout(this.timoutHandle);
      this.timoutHandle = null;
    }
    */
  }
}

export default Tracker;