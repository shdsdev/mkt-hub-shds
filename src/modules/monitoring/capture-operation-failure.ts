import * as Sentry from "@sentry/nextjs";

export function captureOperationFailure(input: {
  operation: string;
  module: string;
  error: unknown;
}): void {
  Sentry.withScope((scope) => {
    scope.setTag("operation", input.operation);
    scope.setTag("module", input.module);
    scope.setTag("handled", "true");
    Sentry.captureException(input.error instanceof Error ? input.error : new Error("Handled operation failure"));
  });
}
