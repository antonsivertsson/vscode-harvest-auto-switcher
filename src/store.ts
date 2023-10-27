import * as vscode from 'vscode';
import { storeKeys } from './constants';

export type TaskInfo = {
  task: {
    id: number
    name: string
  },
  project: {
    id: number
    name: string
    code: string
  }
};

type TaskMap = {[path: string]: TaskInfo};

class Store {
  private store: vscode.Memento;
  lastViewedFile = '';

  constructor(keyStore: vscode.Memento) {
    this.store = keyStore;
    if ((this.store.get(storeKeys.map) as TaskMap | undefined) === undefined) {
      this.store.update(storeKeys.map, {});
    }
  }

  readTaskMap() {
    const map = this.store.get(storeKeys.map) as TaskMap;
    return map;
  }

  /**
   * Adds a default task to the map. Will overwrite if already existing path
   */
  addDefaultTask(path: string, taskInfo: TaskInfo) {
    this.store.update(storeKeys.map, {
      ...this.store.get(storeKeys.map),
      [path]: taskInfo,
    });
  }

  removeDefaultTask(path: string) {
    let map = this.store.get(storeKeys.map) as TaskMap;
    delete map[path];
    this.store.update(storeKeys.map, map);
  }

  /**
   * Given a filename, return the matching default task if any is found
   * @param fileName
   * @returns the default Harvest task ID associated with the file or a parent folder, else undefined
   */
  getDefaultTaskFromFile(fileName: string) {
    const taskMap = this.readTaskMap();
    let closestMatch = '';
    for (let path of Object.keys(taskMap)) {
      if (path.length > closestMatch.length && fileName.includes(path)) {
        closestMatch = path;
      }
    }
    if (closestMatch.length > 0) {
      return taskMap[closestMatch];
    }
    return undefined;
  }

  updateSwitching(enabled: boolean) {
    this.store.update(storeKeys.switching, enabled);
  }

  getSwitching() {
    const enabled = this.store.get(storeKeys.switching) as boolean | undefined;
    if (enabled === undefined) {
      // If not found, set default value
      this.store.update(storeKeys.switching, false);
      return false;
    }
    return enabled;
  }
}

export default Store;