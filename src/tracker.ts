import * as vscode from 'vscode';

import Store from './store';
import { constants } from './constants';
import Harvest from './harvest';
  
/**
 * Keeps track of changes in vscode to determine when to trigger Harvest updates
 */
class Tracker {
  private store: Store;
  private threshold: number;
  /** Harvest Task ID. Used to determine if we've switched to an editor belonging to a different task */
  /** The last active Harvest Entry */
  public activeEntry = {
    projectName: '',
    projectCode: '',
    taskName: '',
    taskId: -1,
    entryId: -1,
    hours: 0,
  };
  public activeTimer = false;
  private timoutHandle: NodeJS.Timeout | null;
  private activeTrackingInterval: NodeJS.Timeout | null;
  private amIStillRunningInterval: NodeJS.Timeout | null;
  private harvest: Harvest;
  private statusBar: vscode.StatusBarItem;
  private switching: boolean;

  constructor(store: Store, statusBar: vscode.StatusBarItem, harvestController: Harvest, threshold?: number) {
    this.store = store;
    this.harvest = harvestController;
    this.statusBar = statusBar;
    this.threshold = threshold ?? 5 * 60 * 1000;
    this.switching = this.store.getSwitching();
    this.timoutHandle = null;
    this.activeTrackingInterval = null;

    this.amIStillRunningInterval = setInterval(async () => {
      // Periodically check if harvest has accepted any external changes to
      // time tracking that we are not aware of
      const activeEntry = await this.harvest.getActiveTimeEntry();
      if (!activeEntry && this.activeTimer) {
        // Stop tracking if external harvest isn't currently tracking
        this.activeTimer = false;
        this.stopTracking();
        this.updateStatusBar();
      } else if (activeEntry && activeEntry.id !== this.activeEntry.entryId) {
        // If harvest is tracking another task, update our task
        this.activeEntry = {
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
   * Triggered when on user navigating to new view. Should be triggered when commands to update default
   * tasks are performed
   * @param event
   * @returns 
   */
  activeEditorChanged(event: vscode.TextEditor | undefined) {
    // TODO: See if there are other allowed uri schemes that should be allowed
    if (!this.switching || event === undefined || event.document.uri.scheme !== 'file') {
      return;
    }
    const { fileName } = event.document;
    this.store.lastViewedFile = fileName; // Set the last viewed file
    const defaultTask = this.store.getDefaultTaskFromFile(fileName);
    if (defaultTask && defaultTask.task.id !== this.activeEntry.taskId) {
      this.timoutHandle = setTimeout(() => {
        // Trigger Harvest change
        vscode.window.showInformationMessage(`Was: ${this.activeEntry.taskId}, is now: ${defaultTask}`);
      }, this.threshold);
    } else if (this.timoutHandle) {
      clearTimeout(this.timoutHandle);
      this.timoutHandle = null;
    }
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
   * Updates the status bar given the status of time tracking
   */
  public updateStatusBar() {
    // FIXME: If currently tracking an entry and the project code or name
    let statusBarText = '$(watch)';
    let tooltipText = '';
    if (this.switching) {
      statusBarText += ' $(arrow-swap)';
    }
    if (this.activeTimer) {
      this.statusBar.color = new vscode.ThemeColor('statusBar.debuggingForeground');
    } else {
      this.statusBar.color = new vscode.ThemeColor('statusBar.foreground');
    }
    // FIXME: add configurable to settings
    if (this.activeEntry.projectCode !== '') {
      statusBarText += ` ${this.activeEntry.projectCode} -`;
    }
    if (this.activeEntry.taskName !== '') {
      statusBarText += ` ${this.activeEntry.taskName}`;
    }
    tooltipText += `${this.activeEntry.projectName}
    ${this.activeEntry.taskName}`;
    statusBarText += ` ${Tracker.hoursToText(this.activeEntry.hours)}`;
    this.statusBar.tooltip = tooltipText;
    this.statusBar.text = statusBarText;
  }

  /**
   * Enables switching functionality
   */
  enableSwitching() {
    this.store.updateSwitching(true);
    this.switching = true;
  }

  /**
   * Disables switching functionality
   */
  disableSwitching() {
    this.store.updateSwitching(false);
    this.switching = false;
  }

  /**
   * Starts an interval that increases the hours on the active entry
   * and renders the result in the status bar.
   */
  public startTracking() {
    if (this.activeTrackingInterval === null) {
      this.activeTrackingInterval = setInterval(() => {
        this.activeEntry.hours += Tracker.minsToHourFloat(1);
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
    if (this.activeTrackingInterval) {
      clearInterval(this.activeTrackingInterval);
      this.activeTrackingInterval = null;
    }
  }
}

export default Tracker;