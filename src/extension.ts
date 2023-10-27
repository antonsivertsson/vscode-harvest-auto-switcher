// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { storeKeys } from './constants';
import UIHandler from './ui';
import Tracker from './tracker';
import Store from './store';
import Harvest from './harvest';
import { NoTokenError } from './errors';
import changeTask from './commands/changeTask';
import setDefaultTask from './commands/setDefaultTask';
import pauseEntry from './commands/pauseEntry';
import unpauseEntry from './commands/unpauseEntry';
import removeDefaultTask from './commands/removeDefaultTasks';
import toggleSwitching from './commands/toggleSwitching';

let statusBarItem: vscode.StatusBarItem;

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	
	const store = new Store(context.globalState);
	
	let accessToken = ((context.globalState.get(storeKeys.accessToken) || context.globalState.get(storeKeys.accessToken)) as string | undefined) ?? '';
	let accountId = ((context.globalState.get(storeKeys.accountId) || context.globalState.get(storeKeys.accessToken)) as string | undefined) ?? '';
	let userId = ((context.globalState.get(storeKeys.userId) || context.globalState.get(storeKeys.userId)) as number | undefined) ?? -1;
	
	statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 1);
	const uiHandler = new UIHandler();
	const harvestController = new Harvest({ accessToken, accountId, userId });
	const tracker = new Tracker(store, statusBarItem, harvestController,  5000);	
	
	if (accessToken === '' || accountId === '' || userId === -1) {
		statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
		statusBarItem.text = `$(watch) setup`;
		statusBarItem.command = 'vscode-harvest-auto-switcher.updateHarvestToken';
	} else { 
		statusBarItem.text = `$(watch)`;
	}

	// We don't need to wait for this to resolve before executing the rest of our code
	harvestController.init()
		.then((activeEntry) => {
			if (activeEntry) {
				// FIXME: Compile into a more manageable format since we do this a few times
				tracker.activeEntry = {
					projectCode: activeEntry.project.code,
					projectName: activeEntry.project.name,
					taskName: activeEntry.task.name,
					hours: activeEntry.hours,
					taskId: activeEntry.task.id,
					entryId: activeEntry.id,
				};
				tracker.activeTimer = true;
				tracker.startTracking();
				tracker.updateStatusBar();
			}
		})
		.catch((err) => {
			// TODO: If missing valid credentials, show error and update UI
			if (err instanceof NoTokenError) {
				vscode.window.showErrorMessage(err.message);
				statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
				statusBarItem.text = `$(watch) login`;
				statusBarItem.tooltip = 'No valid credentials found';
				statusBarItem.command = 'vscode-harvest-auto-switcher.updateHarvestToken';
			}
		});

	context.subscriptions.push(vscode.commands.registerCommand('vscode-harvest-auto-switcher.updateHarvestToken', async () => {
		const harvestToken = await uiHandler.getHarvestToken();
		if (!harvestToken) {
			return;
		}
		try {
			const res = await harvestController.setCredentials(harvestToken.accessToken, harvestToken.accountId);
			context.globalState.update(storeKeys.accessToken, harvestToken.accessToken);
			context.globalState.update(storeKeys.accountId, harvestToken.accountId);
			context.globalState.update(storeKeys.userId, res.userId);
		} catch (err) {
			if (err instanceof NoTokenError) {
				vscode.window.showErrorMessage(err.message);
			}
		}
	}));

	// TODO: Add a function to update all UI if harvest is tracking another task than previously thought: Tracker.activeTask, Tracker.isRunning = true,
	context.subscriptions.push(vscode.commands.registerCommand('vscode-harvest-auto-switcher.changeTask', changeTask(harvestController, tracker)));
	context.subscriptions.push(vscode.commands.registerCommand('vscode-harvest-auto-switcher.setDefaultTask', setDefaultTask(harvestController, store)));
	context.subscriptions.push(vscode.commands.registerCommand('vscode-harvest-auto-switcher.pause', pauseEntry(harvestController, tracker)));
	context.subscriptions.push(vscode.commands.registerCommand('vscode-harvest-auto-switcher.unpause', unpauseEntry(harvestController, tracker)));
	context.subscriptions.push(vscode.commands.registerCommand('vscode-harvest-auto-switcher.removeDefaultTask', removeDefaultTask(store)));
	context.subscriptions.push(vscode.commands.registerCommand('vscode-harvest-auto-switcher.toggleSwitching', toggleSwitching(store, tracker)));

	context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor((e) => {
		tracker.activeEditorChanged(e);
	}));
	context.subscriptions.push(statusBarItem);
	statusBarItem.show();
}

// This method is called when your extension is deactivated
export function deactivate() {}
