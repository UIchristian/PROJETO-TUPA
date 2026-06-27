/**
 * Lightweight signal emitted whenever the API layer falls back to mock data.
 * Components subscribe via useSyncExternalStore to show a visible indicator.
 */
let _occurred = false;
const _listeners = new Set<() => void>();

export const fallbackBus = {
  get occurred(): boolean {
    return _occurred;
  },
  signal() {
    if (!_occurred) {
      _occurred = true;
      _listeners.forEach((l) => l());
    }
  },
  reset() {
    _occurred = false;
    _listeners.forEach((l) => l());
  },
  subscribe(cb: () => void): () => void {
    _listeners.add(cb);
    return () => _listeners.delete(cb);
  },
};
