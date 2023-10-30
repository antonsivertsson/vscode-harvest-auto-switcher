import * as vscode from 'vscode';
  
import Harvest, { HarvestResponse } from "../harvest";
import Tracker from "../tracker";

type ProjectTaskItem = vscode.QuickPickItem & { value: { taskId: number, projectId: number } };
type AvailableEntryItem = vscode.QuickPickItem & { value: number, entry?: HarvestResponse.TimeEntry };

// TODO: Should first present the entries for today + adding a new one
// -> Clicking one of the pre-existing will start tracking that one again (with option to append text)
// -> Clicking "new" will open new dialog with tasks you can add -> then the option to add description

// QUESTION: How/Where do we show the total time tracked today? -> Show in tooltip for status bar

/**
 * If no existing entry is running for selected task, create new task and start it.
 * If previous entry exists (for today), switch to that task and start running.
 * If another task is running
 */
const startEntry = (harvestController: Harvest, tracker: Tracker) => async () => {
  const quickPickItems = async () => {
    // FIXME: Change to get todays timers? Only problem if timer was started yesterday...
    const todaysEntries = await harvestController.get.timeEntries();
    const availableEntries = todaysEntries.time_entries.reduce((result, entry) => {
      const item: AvailableEntryItem = {
        label: `${entry.project.code !== '' ? entry.project.code : entry.project.name} - ${entry.task.name}`,
        description: `${entry.is_running ? `$(loading~spin)` : ``} ${Tracker.hoursToText(entry.hours)}`,
        detail: entry.notes,
        value: entry.id,
        entry,
      };
      result.push(item);
      return result;
    }, [] as AvailableEntryItem[]);

    // Sort to get the active timer at the top (if it exists) or the previously active entry (if there is one).
    // Keep the rest of the results unsorted
    availableEntries.sort((a, b) => a.entry?.is_running ? -2 : tracker.lastActiveEntry.entryId === a.entry?.id ? -1 : 0);
    availableEntries.push({
      label: `$(plus) New entry`,
      detail: 'Add new entry',
      value: -1,
    });
    return availableEntries;
  };

  const selected = await vscode.window.showQuickPick(quickPickItems(), { title: `Select entry to switch to` });
  if (!selected) {
    return;
  }

  if (selected.entry?.is_running) {
    // FIXME: Notes may erase newline if present in text added from external harvest app
    const newNotes = await vscode.window.showInputBox({ value: selected.entry.notes, placeHolder: 'Add Notes...' });
    if (newNotes === selected.entry.notes || newNotes === undefined) {
      return;
    }
    await harvestController.update.notes(selected.entry.id, newNotes);
    tracker.activeTimer = true;
    tracker.lastActiveEntry = {
      projectCode: selected.entry.project.code,
      projectName: selected.entry.project.name,
      taskName: selected.entry.task.name,
      hours: selected.entry.hours,
      taskId: selected.entry.task.id,
      entryId: selected.entry.id,
    };
    tracker.startTracking();
    tracker.updateStatusBar();
  } else if (selected.value === -1) {
    // If adding a new entry, show list of possible entries, then allow us to add notes
    const tasks = harvestController.projectTasks.reduce((result, project) => {
      const tasksWithProjectName = project.tasks.map((task) => ({
        label: `${project.code !== '' ? project.code : project.name} - ${task.name}`,
        description: project.code !== '' ? `$(project) ${project.name}` : undefined,
        value: {
          taskId: task.id,
          projectId: project.id,
        }
      }));
      return [...result, ...tasksWithProjectName];
    }, [] as ProjectTaskItem[]);
    
    const selectedTask = await vscode.window.showQuickPick(tasks);
    if (!selectedTask) {
      return;
    }
    const newNotes = await vscode.window.showInputBox({ placeHolder: 'Add Notes...' });
    const newEntry = await harvestController.create.newEntry(selectedTask.value.projectId, selectedTask.value.taskId, newNotes);
    tracker.activeTimer = true;
    tracker.lastActiveEntry = {
      projectCode: newEntry.project.code,
      projectName: newEntry.project.name,
      taskName: newEntry.task.name,
      hours: newEntry.hours,
      taskId: newEntry.task.id,
      entryId: newEntry.id,
    };
    // Disable switching if we changed task while in file that has a different associated task
    const associatedTask = tracker.getAssociatedTask(tracker.lastViewedFile);
    if (associatedTask && associatedTask.task.id !== newEntry.task.id) {
      tracker.disableSwitching();
    }
    tracker.startTracking();
    tracker.updateStatusBar();
  } else {
    const newNotes = await vscode.window.showInputBox({ value: selected.entry!.notes, placeHolder: 'Add Notes...' });
    if (newNotes === undefined) {
      // Abort if user cancels
      return;
    }
    let promises = [harvestController.update.startEntry(selected.value)];
    if (newNotes !== selected.entry!.notes) {
      promises.push(harvestController.update.notes(selected.value, newNotes));
    }
    await Promise.all(promises);
    tracker.activeTimer = true;
    tracker.lastActiveEntry = {
      projectCode: selected.entry!.project.code,
      projectName: selected.entry!.project.name,
      taskName: selected.entry!.task.name,
      hours: selected.entry!.hours,
      taskId: selected.entry!.task.id,
      entryId: selected.entry!.id,
    };
    // Disable switching if we changed task while in file that has a different associated task
    const associatedTask = tracker.getAssociatedTask(tracker.lastViewedFile);
    if (associatedTask && associatedTask.task.id !== selected.entry!.task.id) {
      tracker.disableSwitching();
    }
    tracker.startTracking();
    tracker.updateStatusBar();
  }
};
  
export default startEntry;