import * as vscode from 'vscode';
import constants from './constants';

type TaskMap = Map<string, number>;

class Store {
  private store: vscode.Memento;

  constructor(keyStore: vscode.Memento) {
    this.store = keyStore;
  }

  readTaskMap() {
    const map = this.store.get(constants.keys.store.map) as TaskMap;
    return map;
  }

  /**
   * Given a filename, return the task if any is found matching the path.
   * @param fileName
   * @returns the default Harvest task ID associated with the file or a parent folder, else undefined
   */
  getDefaultTaskFromFile(fileName: string) {
    const taskMap = this.readTaskMap();
    let closestMatch = '';
    for (let path of taskMap.keys()) {
      if (path.length > closestMatch.length && fileName.includes(path)) {
        closestMatch = path;
      }
    }
    if (closestMatch.length > 0) {
      return taskMap.get(closestMatch);
    }
    return undefined;
  }
}

export default Store;