/** History stores accepted transactions, never individual keystrokes. */
export function createHistory<T>(limit = 50) {
  let past: T[] = [],
    future: T[] = [];
  return {
    get canUndo() {
      return past.length > 0;
    },
    get canRedo() {
      return future.length > 0;
    },
    record(previous: T) {
      past = [...past, previous].slice(-limit);
      future = [];
    },
    undo(current: T): T | undefined {
      const value = past.pop();
      if (value !== undefined) future.push(current);
      return value;
    },
    redo(current: T): T | undefined {
      const value = future.pop();
      if (value !== undefined) past.push(current);
      return value;
    },
    clear() {
      past = [];
      future = [];
    },
  };
}
