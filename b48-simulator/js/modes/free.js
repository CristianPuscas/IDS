/**
 * Modul Liber: reguli dezactivate (sim.setEnforce(false)), fără obiective. Lecțiile pot fi parcurse liber (Înapoi/Sari).
 */
import { h } from '../ui/dom.js';

export function createFreeMode(app) {
  return {
    id: 'free',
    name: 'Liber',
    enter() {
      app.sim.setEnforce(false);
      app.view.setHint(null);
      app.hud.setMode(h('div.hud-card',
        h('div.hud-title', '🧰 Mod liber'),
        h('div.hud-text', 'Reguli de ordine dezactivate: demontați și montați orice piesă pentru a explora motorul. Fără obiective și fără punctaj.')));
    },
    exit() {}
  };
}
