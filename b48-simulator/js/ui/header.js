/**
 * Antet (mod de joc, variantă, salvare/resetare, sunet, temă) și bara de unelte a vizualizării 3D.
 */
import { $, toast } from './dom.js';
import { choiceDialog } from './modal.js';
import { openVariantDialog, variantLabel } from './dialogVariant.js';

export class Header {
  constructor(app) {
    this.app = app;
    const { storage, audio } = app;

    // mod
    this.modeSel = $('#mode-select');
    this.modeSel.addEventListener('change', async () => {
      const target = this.modeSel.value;
      const ok = await app.modes.switchTo(target);
      if (!ok) this.modeSel.value = app.modes.currentId;
    });

    // variantă
    $('#btn-variant').addEventListener('click', () => openVariantDialog(app));
    this.updateVariant();

    // temă
    $('#btn-theme').addEventListener('click', () => this.setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));

    // salvare / resetare
    $('#btn-save').addEventListener('click', () => app.saveProgress());
    $('#btn-reset').addEventListener('click', async () => {
      const c = await choiceDialog('Resetare', 'Ce doriți să resetați?', [
        { label: 'Renunță', value: null },
        { label: 'Șterge tot progresul', value: 'all', kind: 'danger' },
        { label: 'Resetează motorul', value: 'engine', kind: 'primary' }
      ]);
      if (c === 'engine') app.resetEngine();
      else if (c === 'all') app.resetAll();
    });

    // audio
    const vol = $('#volume');
    const mute = $('#btn-mute');
    vol.value = String(Math.round((storage.get('volume', 0.7) ?? 0.7) * 100));
    const syncMute = () => {
      mute.textContent = audio.muted ? '🔇' : '🔊';
      mute.setAttribute('aria-pressed', String(audio.muted));
      mute.setAttribute('aria-label', audio.muted ? 'Sunet oprit — apasă pentru a porni' : 'Sunet pornit — apasă pentru a opri');
    };
    vol.addEventListener('input', () => { audio.setVolume(Number(vol.value) / 100); storage.set('volume', audio.volume); if (audio.muted && audio.volume > 0) { audio.setMuted(false); storage.set('muted', false); syncMute(); } });
    mute.addEventListener('click', () => { audio.ensure(); audio.setMuted(!audio.muted); storage.set('muted', audio.muted); syncMute(); });
    syncMute();

    // panouri pe ecran îngust
    const toggle = (btnId, cls) => {
      const btn = $(btnId);
      btn.addEventListener('click', () => {
        const on = !document.body.classList.contains(cls);
        document.body.classList.remove('show-left', 'show-right');
        if (on) document.body.classList.add(cls);
        $('#btn-toggle-left').setAttribute('aria-expanded', String(document.body.classList.contains('show-left')));
        $('#btn-toggle-right').setAttribute('aria-expanded', String(document.body.classList.contains('show-right')));
      });
    };
    toggle('#btn-toggle-left', 'show-left');
    toggle('#btn-toggle-right', 'show-right');

    this.setupToolbar();
  }

  setTheme(theme) {
    const t = theme === 'light' ? 'light' : 'dark';
    document.documentElement.dataset.theme = t;
    this.app.storage.set('theme', t);
    try { this.app.view.setTheme(t); } catch (err) { console.error(err); }
  }

  updateVariant() {
    const b = $('#variant-badge');
    const label = variantLabel(this.app);
    b.textContent = `Variantă: ${label}`;
    b.className = `badge ${this.app.data.variants?.selected === 'demo' ? 'badge-demo' : 'badge-warn'}`;
  }

  setMode(id) { this.modeSel.value = id; }

  setupToolbar() {
    const { app } = this;
    const explode = $('#explode');
    explode.addEventListener('input', () => app.view.setExplode(Number(explode.value) / 100));
    const xray = $('#btn-xray');
    xray.addEventListener('click', () => {
      const on = xray.getAttribute('aria-pressed') !== 'true';
      xray.setAttribute('aria-pressed', String(on));
      app.view.setXray(on);
    });
    const labels = $('#labels');
    labels.addEventListener('change', () => app.view.setLabels(labels.value));
    const ghost = $('#btn-ghost');
    ghost.addEventListener('click', () => {
      const on = ghost.getAttribute('aria-pressed') !== 'true';
      ghost.setAttribute('aria-pressed', String(on));
      app.view.setGhostRemoved(on);
      app.syncView?.();
    });
    $('#btn-camera').addEventListener('click', () => app.view.resetCamera());
    $('#btn-engine').addEventListener('click', () => {
      app.audio.ensure();
      app.engine.toggle();
    });
    $('#btn-final').addEventListener('click', () => app.actions.perform('final_check', null));
    try { app.view.setLabels(labels.value); } catch (err) { console.error(err); }
  }

  /** Setează programatic controalele (ex. demonstrații de lecție). */
  setExplodeValue(t) { $('#explode').value = String(Math.round(t * 100)); }
  setXrayPressed(on) { $('#btn-xray').setAttribute('aria-pressed', String(!!on)); }
}

export function notifySaved(ok) {
  toast(ok ? 'Progres salvat local.' : 'Progresul nu a putut fi salvat (stocare locală blocată) — rămâne doar pentru această sesiune.', ok ? 'success' : 'warn');
}
