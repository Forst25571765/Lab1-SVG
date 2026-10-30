export class SvgFormatError extends Error {
  public constructor(message: string, options?: ErrorOptions) {
    super(`invalid svg: ${message.replace(/\s+/g, " ").trim()}`, options);
    this.name = "SvgFormatError";
  }
}
