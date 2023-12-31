import * as vscode from 'vscode';
import * as path from 'path';

import Harvest from '../harvest';
import Store, { TaskInfo } from '../store';
import Tracker from '../tracker';

type DefaultTaskQuickPickItem = vscode.QuickPickItem & { value: TaskInfo };

const setAssociatedTask = (harvestController: Harvest, store: Store, tracker: Tracker) => async () => {
  if (harvestController.projectTasks.length === 0) {
    await harvestController.refreshProjectTasks();
  }
  // FIXME: Make sure lastViewedFile always is a file, otherwise path.dirname might give weird results
  const pathPlaceholder = tracker.lastViewedFile !== ''
    ? path.dirname(tracker.lastViewedFile) : vscode.workspace.workspaceFolders
      ? vscode.workspace.workspaceFolders[0].uri.path : '';
  
  const pathName = await vscode.window.showInputBox({ title: 'Enter file or folder to associate with task', value: pathPlaceholder });
  if (!pathName) {
    // If user cancelled interaction, do nothing
    return;
  }

  const quickPickItems = harvestController.projectTasks.reduce((result, project) => {
      const tasksWithProjectName = project.tasks.map((task) => ({
        label: `${project.code !== '' ? project.code : project.name} - ${task.name}`,
        description: project.code !== '' ? `$(project) ${project.name}` : undefined,
        value: {
          task: { id: task.id, name: task.name },
          project: { name: project.name, code: project.code, id: project.id }
        }
      }));
      return [...result, ...tasksWithProjectName];
  }, [] as DefaultTaskQuickPickItem[]);
  
  // quickPickItems.push(({ label: 'DONT TRACK', value: { task: { id: -1, name: 'DONT TRACK' }, project: { id: -1, name: 'NO TRACKING', code: 'NO' } } }));
  
  const selected = await vscode.window.showQuickPick(quickPickItems, { title: 'Select task to associate with path' });
  if (!selected) {
    // Don't save if user cancels
    return;
  }
  store.addDefaultTask(pathName, selected.value);
};
  
export default setAssociatedTask;
