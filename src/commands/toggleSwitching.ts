import Store from "../store";
import Tracker from "../tracker";

const toggleSwitching = (store: Store, tracker: Tracker) => async () => {
  const currentSwitching = store.getSwitching();
  store.setSwitching(!currentSwitching);
  currentSwitching ? tracker.disableSwitching() : tracker.enableSwitching();
  tracker.updateStatusBar();
};

export default toggleSwitching;