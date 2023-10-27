import Store from "../store";
import Tracker from "../tracker";

const toggleSwitching = (store: Store, tracker: Tracker) => async () => {
  const currentSwitching = store.getSwitching();
  store.updateSwitching(!currentSwitching);
  currentSwitching ? tracker.disableSwitching() : tracker.enableSwitching();
};

export default toggleSwitching;