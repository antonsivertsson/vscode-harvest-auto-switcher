class NoTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NoTokenError";
  }
}

/**
 * Returned by Harvest API when trying to pause a non-running timer
 */
class HarvestInvalidPauseTimeError extends Error {
    constructor(message: string) {
    super(message);
    this.name = "HarvestInvalidPauseTimeError";
    }
}

class HarvestLockedEntryError extends Error {
    constructor(message: string) {
    super(message);
    this.name = "HarvestLockedEntryError";
    }
}

export {
  NoTokenError,
  HarvestInvalidPauseTimeError,
  HarvestLockedEntryError,
};