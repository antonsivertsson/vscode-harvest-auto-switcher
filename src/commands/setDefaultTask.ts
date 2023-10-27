import * as vscode from 'vscode';
import * as path from 'path';

import Harvest from '../harvest';
import Store, { TaskInfo } from '../store';

type DefaultTaskQuickPickItem = vscode.QuickPickItem & { value: TaskInfo };

const setDefaultTask = (harvestController: Harvest, store: Store) => async () => {
  if (harvestController.projectTasks.length === 0) {
    await harvestController.refreshProjectTasks();
  }
  if (!vscode.window.activeTextEditor) {
    throw new Error("No active editor selected");
  }
  // FIXME: Make sure lastViewedFile always is a file, otherwise path.dirname might give weird results
  const filePath = store.lastViewedFile !== ''
    ? store.lastViewedFile : vscode.workspace.workspaceFolders
      ? vscode.workspace.workspaceFolders[0].uri.path : '';
  
  const pathPlaceholder = path.dirname(filePath);
  
  const pathName = await vscode.window.showInputBox({ value: pathPlaceholder });
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
  
  quickPickItems.push(({ label: 'DONT TRACK', value: { task: { id: -1, name: 'DONT TRACK'}, project: { id: -1, name: 'NO TRACKING', code: 'NO'}} }));

  // TODO: Add extra task for DONT TRACK
  const selected = await vscode.window.showQuickPick(quickPickItems);
  if (!selected) {
    // Don't save if user cancels
    return;
  }
  store.addDefaultTask(pathName, selected.value);
};
  
export default setDefaultTask;
