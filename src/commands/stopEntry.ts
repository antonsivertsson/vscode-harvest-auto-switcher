import Harvest from "../harvest";
import Tracker from "../tracker";

/**
 * Pauses whatever entry is active in harvest right now
 * Triggers update to UI if active entry is different from the tracker
 * @param harvestController 
 * @returns 
 */
const stopEntry = (harvestController: Harvest, tracker: Tracker) => async () => {
  const activeEntry = await harvestController.get.activeTimeEntry();
  if (activeEntry) {
    await harvestController.update.stopEntry(activeEntry.id);
    tracker.lastActiveEntry = {
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

export default stopEntry;