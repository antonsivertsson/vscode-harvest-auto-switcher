import Harvest from "../harvest";
import Tracker from "../tracker";

/**
 * Pauses whatever entry is active in harvest right now
 * Triggers update to UI if active entry is different from the tracker
 * @param harvestController 
 * @returns 
 */
const pauseEntry = (harvestController: Harvest, tracker: Tracker) => async () => {
  const activeEntry = await harvestController.getActiveTimeEntry();
  if (activeEntry) {
    await harvestController.stopEntry(activeEntry.id);
    tracker.activeEntry = {
      projectCode: activeEntry.project.code,
      projectName: activeEntry.project.name,
      taskName: activeEntry.task.name,
      hours: activeEntry.hours,
      taskId: activeEntry.task.id,
      entryId: activeEntry.id,
    };
    tracker.activeTimer = false;
  }
  tracker.stopTracking();
  tracker.updateStatusBar();
};

export default pauseEntry;