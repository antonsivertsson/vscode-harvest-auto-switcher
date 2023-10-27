// Handles user interactions in the extension
import * as vscode from 'vscode';
import { ProjectTasks } from './harvest';

class UIHandler {
  /**
   * Gets the AccessToken from user and saves it
   */
  async getNewAccessToken() {
    return vscode.window.showInputBox({ placeHolder: "Access Token from Harvest" });
  }

  async getNewAccountId() {
    return vscode.window.showInputBox({ placeHolder: "Account/Organization ID from Harvest" });
    // if (accountId !== undefined && accountId.length > 0) {
    //   // Save access token to workspace
    //   await this.store.update(keys.store.accountId, accountId);
    // } else {
    //   this.printError('Must supply an accountId');
    // }
  }

  async getHarvestToken() {
    const accessToken = await vscode.window.showInputBox({ placeHolder: 'Access Token from Harvest', ignoreFocusOut: true }) ?? '';
    if (!accessToken) {
      return;
    }
    const accountId = await vscode.window.showInputBox({ placeHolder: 'Account/Organization ID from Harvest', ignoreFocusOut: true }) ?? '';
    return { accessToken, accountId };
  }

  async showHarvestTasks(projectTasks: ProjectTasks[]) {
    		const selected = await vscode.window.showQuickPick(
			projectTasks.reduce((result, project) => {
				const tasksWithProjectName = project.tasks.map((task) => ({
					label: `${project.code !== '' ? project.code : project.name} - ${task.name}`,
					description: project.code !== '' ? `$(project) ${project.name}` : undefined,
					value: task.id
				}));
				return [...result, ...tasksWithProjectName];
			}, [] as vscode.QuickPickItem[])
		);
  }
  
  async printError(message: string, actions?: string[]) {
    return vscode.window.showErrorMessage(message, ...actions || []);
  }
}

export default UIHandler;