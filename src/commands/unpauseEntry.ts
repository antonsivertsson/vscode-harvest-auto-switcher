import * as vscode from 'vscode';
import Harvest, { HarvestResponse } from "../harvest";
import Tracker from "../tracker";

type ProjectTaskItem = vscode.QuickPickItem & { value: { taskId: number, projectId: number } };
type AvailableEntryItem = vscode.QuickPickItem & { value: number, entry?: HarvestResponse.TimeEntry };

const unpauseEntry = (harvestController: Harvest, tracker: Tracker) => async () => {
  if (tracker.activeEntry.entryId === -1) {
    // If there is no previously active entry (e.g. on startup of extension), show list of entries with possibility to add one
    const quickPickItems = async () => {
      // First, prepare by getting any active time entries

      // FIXME: Move shared code to separate file
      const todaysEntries = await harvestController.getTimeEntries();
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

      // Sort to get the active timer at the top
      availableEntries.sort((a, b) => a.entry?.is_running ? -1 : 0);
      availableEntries.push({
        label: `$(plus) New entry`,
        detail: 'Add new entry',
        value: -1,
      });
      return availableEntries;
    };

    const selected = await vscode.window.showQuickPick(quickPickItems(), { title: `Select entry to start` });
    if (!selected) {
      return;
    }

    if (selected.value === -1) {
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
      const newEntry = await harvestController.addNewEntry(selectedTask.value.projectId, selectedTask.value.taskId, newNotes);
      tracker.activeTimer = true;
      tracker.activeEntry = {
        projectCode: newEntry.project.code,
        projectName: newEntry.project.name,
        taskName: newEntry.task.name,
        hours: newEntry.hours,
        taskId: newEntry.task.id,
        entryId: newEntry.id,
      };
      tracker.updateStatusBar();
    } else {
      await harvestController.startEntry(selected.entry!.id);
      tracker.activeTimer = true;
      tracker.activeEntry = {
        projectCode: selected.entry!.project.code,
        projectName: selected.entry!.project.name,
        taskName: selected.entry!.task.name,
        hours: selected.entry!.hours,
        taskId: selected.entry!.task.id,
        entryId: selected.entry!.id,
      };
      tracker.updateStatusBar();
    }
  } else {
    await harvestController.startEntry(tracker.activeEntry.entryId);
    tracker.activeTimer = true;
    tracker.updateStatusBar();
  }
  tracker.startTracking();
};

export default unpauseEntry;