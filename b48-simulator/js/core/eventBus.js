/**
 * Magistrală simplă de evenimente (publish/subscribe) folosită de toate modulele.
 * bus.on(evt, fn) -> funcție de dezabonare; bus.emit(evt, payload); bus.once(evt, fn)
 */
export class EventBus {
  constructor() { this._h = new Map(); }
  on(evt, fn) {
    if (!this._h.has(evt)) this._h.set(evt, new Set());
    this._h.get(evt).add(fn);
    return () => this.off(evt, fn);
  }
  once(evt, fn) {
    const off = this.on(evt, (p) => { off(); fn(p); });
    return off;
  }
  off(evt, fn) { this._h.get(evt)?.delete(fn); }
  emit(evt, payload) {
    const set = this._h.get(evt);
    if (!set) return;
    for (const fn of [...set]) {
      try { fn(payload); } catch (err) { console.error(`[EventBus] handler pentru "${evt}" a eșuat:`, err); }
    }
  }
}
