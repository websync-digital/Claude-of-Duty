/**
 * events.js
 * A lightweight EventBus to handle decoupled communication between systems.
 * Supports the `on` and `emit` paradigm required by the advanced UI.
 */
export class EventBus {
  constructor() {
    this._listeners = new Map();
  }

  /**
   * Subscribe to an event.
   * @param {string} type 
   * @param {function} fn 
   * @returns {function} Unsubscribe callback
   */
  on(type, fn) {
    if (!this._listeners.has(type)) {
      this._listeners.set(type, new Set());
    }
    this._listeners.get(type).add(fn);

    return () => {
      this.off(type, fn);
    };
  }

  /**
   * Unsubscribe from an event.
   * @param {string} type 
   * @param {function} fn 
   */
  off(type, fn) {
    const list = this._listeners.get(type);
    if (list) {
      list.delete(fn);
      if (list.size === 0) {
        this._listeners.delete(type);
      }
    }
  }

  /**
   * Emit an event with an optional payload.
   * @param {string} type 
   * @param {any} payload 
   */
  emit(type, payload) {
    const list = this._listeners.get(type);
    if (list) {
      for (const fn of list) {
        try {
          fn(payload);
        } catch (err) {
          console.error(`Error in event listener for ${type}:`, err);
        }
      }
    }
  }
}
