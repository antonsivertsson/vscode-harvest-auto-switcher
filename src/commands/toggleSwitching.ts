import AssociatedTaskManager from "../handlers/associatedTaskManager"
import Tracker from "../tracker"

const toggleSwitching =
  (associatedTaskManager: AssociatedTaskManager, tracker: Tracker) => async () => {
    const currentSwitching = associatedTaskManager.getSwitching()
    associatedTaskManager.setSwitching(!currentSwitching)
    currentSwitching ? tracker.disableSwitching() : tracker.enableSwitching()
    tracker.updateStatusBar()
  }

export default toggleSwitching
