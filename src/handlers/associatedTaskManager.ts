import * as vscode from "vscode"
import { storeKeys } from "../constants"

export type TaskInfo = {
  task: {
    id: number
    name: string
  }
  project: {
    id: number
    name: string
    code: string
  }
}

type TaskMap = { [path: string]: TaskInfo }

/**
 * The AssociatedTaskManager is responsible for keeping track of which files and directories map to
 * a certain Project and Task in Harvest.
 */
class AssociatedTaskManager {
  private store: vscode.Memento

  constructor(keyStore: vscode.Memento) {
    this.store = keyStore
    if ((this.store.get(storeKeys.map) as TaskMap | undefined) === undefined) {
      this.store.update(storeKeys.map, {})
    }
  }

  /** Returns the currently stored map of associated tasks */
  readTaskMap() {
    const map = this.store.get(storeKeys.map) as TaskMap
    return map
  }

  /** Adds a default task to the map. Will overwrite if already existing path */
  addDefaultTask(path: string, taskInfo: TaskInfo) {
    this.store.update(storeKeys.map, {
      ...this.store.get(storeKeys.map),
      [path]: taskInfo,
    })
  }

  /**
   * Takes a file path and removes whatever task was associated for that path. Note that it will not
   * remove any associated tasks for its children or beyond.
   */
  removeAssociatedTask(path: string) {
    let map = this.store.get(storeKeys.map) as TaskMap
    delete map[path]
    this.store.update(storeKeys.map, map)
  }

  /**
   * Given a filename, return the matching default task if any is found
   *
   * @param fileName
   * @returns The default Harvest task ID associated with the file or a parent folder, else
   *   undefined
   */
  getAssociatedTaskForFile(fileName: string) {
    const taskMap = this.readTaskMap()
    let closestMatch = ""
    for (let path of Object.keys(taskMap)) {
      if (path.length > closestMatch.length && fileName.includes(path)) {
        closestMatch = path
      }
    }
    if (closestMatch.length > 0) {
      return taskMap[closestMatch]
    }
    // FIXME: Avoid using undefined
    return undefined
  }

  setShowSwitchStartNotification(show: boolean) {
    this.store.update(storeKeys.showSwitchStartNotification, show)
  }

  getShowSwitchStartNotification() {
    const show = this.store.get(storeKeys.switching) as boolean | undefined
    return show ?? false // FIXME: Read from settings
  }

  setSwitching(enabled: boolean) {
    this.store.update(storeKeys.switching, enabled)
  }

  getSwitching() {
    const enabled = this.store.get(storeKeys.switching) as boolean | undefined
    if (enabled === undefined) {
      // If not found, set default value
      this.store.update(storeKeys.switching, false) // FIXME: Read default from settings
      return false
    }
    return enabled
  }
}

export default AssociatedTaskManager
