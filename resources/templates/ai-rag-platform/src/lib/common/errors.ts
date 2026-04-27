export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(message: string, code: string, statusCode = 400) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class NotFoundError extends AppError {
  constructor(message = "not found") {
    super(message, "NOT_FOUND", 404);
    this.name = "NotFoundError";
  }
}

export class ProviderError extends AppError {
  constructor(provider: string, message: string) {
    super(`${provider}: ${message}`, "PROVIDER_ERROR", 502);
    this.name = "ProviderError";
  }
}

export class DocumentProcessingError extends AppError {
  constructor(stage: string, message: string) {
    super(`document processing failed at ${stage}: ${message}`, "DOC_PROCESSING", 500);
    this.name = "DocumentProcessingError";
  }
}
