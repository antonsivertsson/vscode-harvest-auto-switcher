import * as vscode from "vscode"
import AssociatedTaskManager from "../handlers/associatedTaskManager"

const removeAssociatedTask = (associatedTaskManager: AssociatedTaskManager) => async () => {
  const taskMap = associatedTaskManager.readTaskMap()
  if (Object.keys(taskMap).length === 0) {
    await vscode.window.showInformationMessage(
      'No tasks added. Run "Add default task" to get started.',
    )
    return
  }
  const selected = await vscode.window.showQuickPick(
    Object.keys(taskMap).map((path) => {
      const info = taskMap[path]
      return {
        label: `${path} - ${info.project.name}: ${info.task.name}`,
        value: path,
      }
    }),
  )
  if (selected) {
    associatedTaskManager.removeAssociatedTask(selected.value)
  }
}

export default removeAssociatedTask
