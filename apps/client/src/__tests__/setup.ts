// jsdom has no ResizeObserver; charts only need it to exist
class RO {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: typeof RO }).ResizeObserver = (globalThis as unknown as { ResizeObserver?: typeof RO }).ResizeObserver || RO;
