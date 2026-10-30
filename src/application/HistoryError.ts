export class HistoryError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "HistoryError";
  }
}
