class NoTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NoTokenError";
  }
}

export {
  NoTokenError
};