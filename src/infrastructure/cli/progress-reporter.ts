/**
 * Progress Reporter
 * @description Streams CLI progress without coupling to console.
 * Single responsibility: format and emit progress messages.
 *
 * Design note: kept console-based (it's a CLI) but abstracted behind
 * an interface so it can be replaced for testing.
 */
export interface ProgressReporter {
  info(message: string): void;
  success(message: string): void;
  warning(message: string): void;
  error(message: string): void;
  data(message: string): void;
  header(message: string): void;
}

/**
 * Console-based progress reporter.
 * @description Uses simple prefix markers instead of emoji to keep output
 * scriptable (parseable, no-emoji CI environments).
 */
export class ConsoleProgressReporter implements ProgressReporter {
  info(message: string): void {
    process.stdout.write(`[i] ${message}\n`);
  }
  success(message: string): void {
    process.stdout.write(`[OK] ${message}\n`);
  }
  warning(message: string): void {
    process.stdout.write(`[WARN] ${message}\n`);
  }
  error(message: string): void {
    process.stderr.write(`[ERR] ${message}\n`);
  }
  data(message: string): void {
    process.stdout.write(`${message}\n`);
  }
  header(message: string): void {
    process.stdout.write(`\n=== ${message} ===\n`);
  }
}

/**
 * Silent reporter for tests.
 */
export class NullProgressReporter implements ProgressReporter {
  info(): void {}
  success(): void {}
  warning(): void {}
  error(): void {}
  data(): void {}
  header(): void {}
}
