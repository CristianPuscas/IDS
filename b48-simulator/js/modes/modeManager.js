/**
 * Gestionarea modurilor de joc. Fiecare mod: { id, name, enter(), exit(), hasUnsavedProgress?(), beforeAction?(),
 * isToolUsable?(toolId), onToolActive?(toolId) }.
 */
import { confirmDialog } from '../ui/modal.js';
import { toast } from '../ui/dom.js';

export class ModeManager {
  constructor(app) {
    this.app = app;
    this.modes = new Map();
    this.current = null;
    this.switching = false;
  }

  register(mode) { this.modes.set(mode.id, mode); return mode; }
  get(id) { return this.modes.get(id); }
  get currentId() { return this.current?.id || null; }

  hasUnsaved() {
    try { return !!(this.current?.hasUnsavedProgress?.() || this.app.hasUnsavedSim?.() || this.app.lessons?.active); } catch { return false; }
  }

  /** Schimbă modul; cere confirmare dacă există progres nesalvat. Întoarce true dacă s-a schimbat. */
  async switchTo(id, { skipConfirm = false } = {}) {
    const next = this.modes.get(id);
    if (!next) { toast(`Mod necunoscut: ${id}`, 'error'); return false; }
    if (this.current?.id === id) return true;
    if (this.switching) return false;
    if (!skipConfirm && this.current && this.hasUnsaved()) {
      const ok = await confirmDialog('Schimbă modul de joc',
        `Există progres nesalvat în modul curent („${this.current.name}”). Trecerea la „${next.name}” poate reseta starea motorului. Continuați?`,
        { okLabel: 'Schimbă modul', danger: true });
      if (!ok) return false;
    }
    this.switching = true;
    const { app } = this;
    try {
      app.engine?.stop(null, { silent: true });
      app.lessons?.stop();
      try { this.current?.exit?.(); } catch (err) { console.error('[modes] exit:', err); }
      app.hud.clear();
      app.view.setHint(null);
      this.current = next;
      try { await next.enter(); } catch (err) {
        console.error('[modes] enter:', err);
        toast(`Modul „${next.name}” nu a putut fi pornit: ${err.message}`, 'error');
      }
      app.storage.set('mode', id);
      app.header?.setMode(id);
      app.bus.emit('mode:changed', { mode: id });
      app.log('info', `Mod de joc: ${next.name}.`);
      app.markSaved?.();
      app.refresh(true);
      app.inventory?.render();
    } finally {
      this.switching = false;
    }
    return true;
  }

  beforeAction(action, target, opts) { return this.current?.beforeAction?.(action, target, opts) ?? null; }
  isToolUsable(toolId) { return this.current?.isToolUsable ? this.current.isToolUsable(toolId) : true; }
  onToolActive(toolId) { this.current?.onToolActive?.(toolId); }
}
