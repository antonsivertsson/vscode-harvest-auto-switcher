import * as vscode from 'vscode';
import Store from './store';

/**
 * Keeps track of changes in vscode to determine when to trigger Harvest updates
 */
class Tracker {
  private store: Store;
  private threshold: number;
  /** Harvest Task ID. Used to determine if we've switched to an editor belonging to a different task */
  private activeTask = -1;
  private timoutHandle: NodeJS.Timeout | undefined;

  constructor(store: Store, threshold?: number) {
    this.store = store;
    this.threshold = threshold ?? 5 * 60 * 1000;
  }

  /**
   * Triggered when on user navigating to new view. Should be triggered when commands to update default
   * tasks are performed
   * @param event
   * @returns 
   */
  activeEditorChanged(event: vscode.TextEditor | undefined) {
    if (event === undefined) {
      return;
    }
    const { fileName } = event.document;
    const defaultTask = this.store.getDefaultTaskFromFile(fileName);
    if (defaultTask !== this.activeTask) {
      this.timoutHandle = setTimeout(() => {
        // Trigger Harvest change
        vscode.window.showInformationMessage(`Was: ${this.activeTask}, is now: ${defaultTask}`);
      }, this.threshold);
    } else if (this.timoutHandle) {
      clearTimeout(this.timoutHandle);
    }
  }
}

export default Tracker;