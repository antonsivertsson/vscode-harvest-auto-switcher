// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import constants from './constants';
import UIHandler from './ui';
import Tracker from './tracker';
import Store from './store';
import Harvest from './harvest';
import { NoTokenError } from './errors';

let statusBarItem: vscode.StatusBarItem;

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	
	const store = new Store(context.workspaceState);
	const uiHandler = new UIHandler();
	const tracker = new Tracker(store, 5000);	
	
	let accessToken = ((context.workspaceState.get(constants.keys.store.accessToken) || context.globalState.get(constants.keys.store.accessToken)) as string | undefined) ?? '';
	let accountId = ((context.workspaceState.get(constants.keys.store.accountId) || context.globalState.get(constants.keys.store.accessToken)) as string | undefined) ?? '';
	console.log(`${accessToken} - ${accountId}`);

	const harvestController = new Harvest({ accessToken, accountId });

	statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 1);
	statusBarItem.color = 'red';

	if (!accessToken || !accountId) {
		statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
		statusBarItem.text = `$(clock) setup`;
		statusBarItem.command = 'vscode-harvest-auto-switcher.updateHarvestToken';
	} else { 
		statusBarItem.text = `$(clock) $(play)`;
	}


	context.subscriptions.push(vscode.commands.registerCommand('vscode-harvest-auto-switcher.updateHarvestToken', async () => {
		const harvestToken = await uiHandler.getHarvestToken();
		try {
			await harvestController.setCredentials(harvestToken.accessToken, harvestToken.accountId);
		} catch (err) {
			if (err instanceof NoTokenError) {
				vscode.window.showErrorMessage(err.message);
			}
		}
		// const isOk = await harvestController.checkCredentials();
	}));

	context.subscriptions.push(vscode.commands.registerCommand('vscode-harvest-auto-switcher.setDefaultTask', async () => {
		if (harvestController.projectTasks.length === 0) {
			await harvestController.refreshProjectTasks();
		}
		console.log(harvestController.projectTasks);
		vscode.window.showQuickPick(harvestController.projectTasks.map((proj) => proj.name));
	}));

	// For detecting focus change
	// vscode.window.onDidChangeWindowState;
	
	context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor((e) => {
		tracker.activeEditorChanged(e);
	}));
	context.subscriptions.push(statusBarItem);
	statusBarItem.show();
}

// This method is called when your extension is deactivated
export function deactivate() {}
