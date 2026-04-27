export const ExitCode = {
  Ok: 0,
  GeneralError: 1,
  UserInputError: 2,
  ValidationFailure: 3,
} as const;

export type ExitCodeValue = (typeof ExitCode)[keyof typeof ExitCode];

export class HarnessError extends Error {
  readonly exitCode: ExitCodeValue;

  constructor(message: string, exitCode: ExitCodeValue = ExitCode.GeneralError) {
    super(message);
    this.name = "HarnessError";
    this.exitCode = exitCode;
  }
}
