import * as vscode from "vscode"
import { storeKeys } from "./constants"
import Tracker from "./tracker"
import AssociatedTaskManager from "./handlers/associatedTaskManager"
import Harvest from "./handlers/harvest"
import { NoTokenError } from "./errors"
import changeTask from "./commands/startEntry"
import setAssociatedTask from "./commands/setAssociatedTask"
import pauseEntry from "./commands/stopEntry"
import removeAssociatedTask from "./commands/removeAssociatedTasks"
import toggleSwitching from "./commands/toggleSwitching"

let statusBarItem: vscode.StatusBarItem

export async function activate(context: vscode.ExtensionContext) {
  // Retrieve saved data from state
  let accessToken = ((await context.secrets.get(storeKeys.accessToken)) as string | undefined) ?? ""
  let accountId = (context.globalState.get(storeKeys.accountId) as string | undefined) ?? ""
  let userId = (context.globalState.get(storeKeys.userId) as number | undefined) ?? -1

  // Init status bar items
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 1)

  // Init handlers
  const harvestController = new Harvest({ accessToken, accountId, userId })
  const associatedTaskManager = new AssociatedTaskManager(context.globalState)
  const tracker = new Tracker(associatedTaskManager, statusBarItem, harvestController)

  if (vscode.window.activeTextEditor && vscode.window.activeTextEditor.document.fileName) {
    // If extension starts while user is in a file editor, set it as the lastViewedFile
    tracker.lastViewedFile = vscode.window.activeTextEditor.document.fileName
  }

  // If no harvest credentials set, taskbar does "setup" command
  if (accessToken === "" || accountId === "" || userId === -1) {
    statusBarItem.backgroundColor = new vscode.ThemeColor("statusBarItem.errorBackground")
    statusBarItem.text = `$(harvest-auto-timer-running) setup`
    statusBarItem.command = "vscode-harvest-auto-switcher.setHarvestToken"
  } else {
    // If  valid, toggles switching functionality
    statusBarItem.command = "vscode-harvest-auto-switcher.toggleSwitching"
    tracker.updateStatusBar()
  }

  // We don't need to wait for this to resolve before executing the rest of our code
  harvestController
    .init()
    .then((activeEntry) => {
      if (activeEntry) {
        // FIXME: Compile into a more manageable format since we do this a few times
        tracker.lastActiveEntry = {
          projectCode: activeEntry.project.code,
          projectName: activeEntry.project.name,
          taskName: activeEntry.task.name,
          hours: activeEntry.hours,
          taskId: activeEntry.task.id,
          entryId: activeEntry.id,
        }
        tracker.activeTimer = true
        tracker.startTracking()
        tracker.updateStatusBar()
      }
    })
    .catch((err) => {
      // TODO: If missing valid credentials, show error and update UI
      if (err instanceof NoTokenError) {
        vscode.window.showErrorMessage(err.message)
        statusBarItem.backgroundColor = new vscode.ThemeColor("statusBarItem.errorBackground")
        statusBarItem.text = `$(harvest-auto-timer-running) login`
        statusBarItem.tooltip = "No valid credentials found"
        statusBarItem.command = "vscode-harvest-auto-switcher.setHarvestToken"
      }
    })

  context.subscriptions.push(
    vscode.commands.registerCommand("vscode-harvest-auto-switcher.setHarvestToken", async () => {
      const harvestToken = await Harvest.getHarvestToken()
      if (!harvestToken) {
        // FIXME: This should probably not return here... Handle gracefully with NoTokenError
        return
      }
      try {
        const res = await harvestController.setCredentials(
          harvestToken.accessToken,
          harvestToken.accountId,
        )
        context.secrets.store(storeKeys.accessToken, harvestToken.accessToken)
        context.globalState.update(storeKeys.accountId, harvestToken.accountId)
        context.globalState.update(storeKeys.userId, res.userId)
        statusBarItem.command = "vscode-harvest-auto-switcher.toggleSwitching"
        tracker.updateStatusBar()
      } catch (err) {
        if (err instanceof NoTokenError) {
          vscode.window.showErrorMessage(err.message)
        }
      }
    }),
  )

  // TODO: Add a function to update all UI if harvest is tracking another task than previously thought: Tracker.activeTask, Tracker.isRunning = true,
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "vscode-harvest-auto-switcher.startEntry",
      changeTask(harvestController, tracker),
    ),
  )
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "vscode-harvest-auto-switcher.setAssociatedTask",
      setAssociatedTask(harvestController, associatedTaskManager, tracker),
    ),
  )
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "vscode-harvest-auto-switcher.pause",
      pauseEntry(harvestController, tracker),
    ),
  )
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "vscode-harvest-auto-switcher.removeAssociatedTask",
      removeAssociatedTask(associatedTaskManager),
    ),
  )
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "vscode-harvest-auto-switcher.toggleSwitching",
      toggleSwitching(associatedTaskManager, tracker),
    ),
  )

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((e) => {
      tracker.activeEditorChanged(e)
    }),
  )

  // Triggered only on save
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((e) => tracker.onTextDocumentSave(e)),
  )

  // Triggered on any change
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((e) => tracker.onTextDocumentChange(e)),
  )

  context.subscriptions.push(statusBarItem)
  statusBarItem.show()
}

// This method is called when your extension is deactivated
export function deactivate() {}
