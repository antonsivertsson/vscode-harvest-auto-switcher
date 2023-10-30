/**
 * Glossary:
 * 
 * Associated task -> a Harvest task associated to a certain dir or file
 * Task -> Harvest task
 * Entry -> Harvest Entry
 * 
 */

const SEC = 1000;
const MIN = 60 * SEC;
const HOUR = 60 * MIN;

export const storeKeys = {
  accessToken: 'accessToken',
  accountId: 'accountId',
  userId: 'userId',
  map: 'map',
  switching: 'switchingEnabled',
  showSwitchStartNotification: 'showSwitchStartNotif'
};

export const constants = {
  TRACKING_INTERVAL_MS: 1 * MIN,
  CHECK_TRACKING_STATUS_INTERVAL_MS: MIN,
  IDLE_TIME_MS: 5 * MIN,
};