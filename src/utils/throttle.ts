export class Throttle {
  private lastCallAt: Map<string, number> = new Map();

  constructor(private readonly defaultIntervalMs: number) {}

  async wait(scope = "default", intervalMs?: number): Promise<void> {
    const interval = intervalMs ?? this.defaultIntervalMs;
    const last = this.lastCallAt.get(scope) ?? 0;
    const elapsed = Date.now() - last;
    if (elapsed < interval) {
      await sleep(interval - elapsed);
    }
    this.lastCallAt.set(scope, Date.now());
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
