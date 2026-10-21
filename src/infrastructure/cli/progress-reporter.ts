export interface ProgressReporter {
  info(message: string): void;
  success(message: string): void;
  warning(message: string): void;
  error(message: string): void;
  data(message: string): void;
  header(message: string): void;
}

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

export class NullProgressReporter implements ProgressReporter {
  info(): void {}
  success(): void {}
  warning(): void {}
  error(): void {}
  data(): void {}
  header(): void {}
}
