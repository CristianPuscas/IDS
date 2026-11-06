import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Simulator } from '../js/sim/Simulator.js';
import { EventBus } from '../js/core/eventBus.js';

const FIXTURE = JSON.parse(readFileSync(fileURLToPath(new URL('./fixtures/mini.json', import.meta.url)), 'utf8'));
const fresh = (opts = {}) => {
  const bus = new EventBus();
  const events = [];
  for (const e of ['sim:op', 'sim:changed', 'sim:log', 'tool:active']) bus.on(e, (p) => events.push([e, p]));
  const sim = new Simulator(JSON.parse(JSON.stringify(FIXTURE)), bus, { seed: 1, enforce: true, ...opts });
  return { sim, bus, events };
};

/** Pregătește capacul pentru demontare (baterie, conectori, bobine). */
function stripToCover(sim) {
  sim.setActiveTool('tubulara_10');
  assert.equal(sim.setFlag('baterie_deconectata', true).ok, true);
  for (const c of ['conector_bobina_1', 'conector_bobina_2']) assert.equal(sim.disconnect(c).ok, true);
  for (const b of ['bobina_1', 'bobina_2']) {
    assert.equal(sim.loosen(b, 'tubulara_e8').ok, true);
    assert.equal(sim.remove(b).ok, true);
  }
}

describe('stare inițială', () => {
  test('toate piesele montate, strânse din fabrică, conectori conectați, flaguri implicite', () => {
    const { sim } = fresh();
    const st = sim.getPartState('capac_chiulasa');
    assert.equal(st.installed, true);
    assert.equal(st.onEngine, true);
    assert.equal(st.fasteners, 'tight');
    assert.equal(st.torque.status, 'ok');
    assert.equal(st.isNew, false);
    assert.equal(sim.getPartState('garnitura_capac_chiulasa').fasteners, 'none');
    assert.equal(sim.getConnectorState('conector_bobina_1').connected, true);
    assert.equal(sim.getFlag('baterie_deconectata'), false);
    const r = sim.finalCheck();
    assert.equal(r.ok, true, r.reasons.join('\n'));
    assert.equal(r.data.startable, true);
  });

  test('funcționează fără bus și cu date minimale lipsă', () => {
    const sim = new Simulator({ parts: { parts: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B', mountsOn: ['a'] }] } });
    assert.deepEqual(sim.blockers('a'), ['b']);
    assert.equal(sim.remove('b').ok, true);
    assert.equal(sim.remove('a').ok, true);
    assert.equal(sim.finalCheck().data.startable, false);
  });
});

describe('blocanți și conectori', () => {
  test('blocanți derivați (copii non-bench) și expliciți', () => {
    const { sim } = fresh();
    assert.deepEqual(sim.blockers('capac_chiulasa').sort(), ['bobina_1', 'bobina_2']);
    assert.deepEqual(sim.blockers('bujie_1'), ['bobina_1']);
    assert.ok(!sim.blockers('pompa_ulei').includes('rotor_pompa_ulei'), 'benchOnly nu blochează');
    sim.setActiveTool('tubulara_10');
    sim.setFlag('baterie_deconectata', true);
    sim.loosen('capac_chiulasa', 'tubulara_e10');
    const r = sim.remove('capac_chiulasa');
    assert.equal(r.ok, false);
    assert.equal(r.code, 'BLOCKED');
    assert.match(r.message, /«Capac chiulasă».*«Bobină cil\. 1»/);
    sim.loosen('bujie_1', 'cheie_bujii');
    const rb = sim.remove('bujie_1');
    assert.equal(rb.code, 'BLOCKED');
    assert.match(rb.message, /Bobină cil\. 1/);
  });

  test('conector conectat blochează demontarea; deconectare/conectare', () => {
    const { sim } = fresh();
    sim.setActiveTool('tubulara_10');
    sim.setFlag('baterie_deconectata', true);
    sim.loosen('bobina_1', 'tubulara_e8');
    const r = sim.remove('bobina_1');
    assert.equal(r.code, 'CONNECTED');
    assert.match(r.message, /Conectorul «Conector bobină cil\. 1» este încă conectat\./);
    assert.ok(r.reasons.some((x) => x.includes('Deconectează')));
    assert.deepEqual(sim.connectorsOf('bobina_1'), ['conector_bobina_1']);
    assert.equal(sim.disconnect('conector_bobina_1').ok, true);
    assert.equal(sim.remove('bobina_1').ok, true);
    const c = sim.connect('conector_bobina_1');
    assert.equal(c.ok, false);
    assert.equal(c.code, 'MOUNT_MISSING');
  });

  test('elementele de fixare trebuie slăbite înainte de demontare', () => {
    const { sim } = fresh();
    sim.setActiveTool('tubulara_10');
    sim.setFlag('baterie_deconectata', true);
    sim.disconnect('conector_bobina_1');
    const r = sim.remove('bobina_1');
    assert.equal(r.code, 'FASTENED');
    assert.match(r.message, /Șurubul \(1 × E8\) nu este slăbit\./);
    assert.equal(sim.stats.errors, 1);
    assert.equal(sim.stats.mistakes[0].action, 'remove');
  });

  test('sculă greșită / lipsă la slăbire și la scoatere', () => {
    const { sim } = fresh();
    sim.setActiveTool(null);
    const n = sim.loosen('capac_chiulasa');
    assert.equal(n.code, 'NO_TOOL');
    const w = sim.loosen('capac_chiulasa', 'tubulara_e8');
    assert.equal(w.code, 'WRONG_TOOL');
    assert.equal(w.message, 'Sculă incorectă: «Tubulară E8» nu se potrivește. Necesar: «Tubulară E10».');
    const t = sim.loosen('capac_chiulasa', 'cheie_dinamometrica_mica');
    assert.equal(t.code, 'WRONG_TOOL');
    assert.match(t.message, /dinamometrică/);
    // removeTools: filtru
    sim.setFlag('ulei_golit', true, null);
    const f1 = sim.remove('filtru_ulei', null);
    assert.equal(f1.code, 'NO_TOOL');
    const f2 = sim.remove('filtru_ulei', 'tubulara_e10');
    assert.equal(f2.code, 'WRONG_TOOL');
    assert.equal(sim.remove('filtru_ulei', 'cheie_filtru_ulei').ok, true);
    assert.equal(sim.stats.errors, 5);
  });

  test('flag cerut pentru demontare; flag cu sculă', () => {
    const { sim } = fresh();
    sim.disconnect('conector_bobina_1');
    sim.loosen('bobina_1', 'tubulara_e8');
    const r = sim.remove('bobina_1');
    assert.equal(r.code, 'FLAG_REQUIRED');
    assert.match(r.message, /«Baterie deconectată» trebuie să fie activă/);
    const f = sim.setFlag('baterie_deconectata', true, 'tubulara_e8');
    assert.equal(f.code, 'WRONG_TOOL');
    assert.equal(sim.setFlag('baterie_deconectata', true, 'tubulara_10').ok, true);
    assert.equal(sim.remove('bobina_1').ok, true);
    // requiresOff: ulei_golit off cere filtru + pompă montate
    sim.setFlag('ulei_golit', true);
    sim.remove('filtru_ulei', 'cheie_filtru_ulei');
    const off = sim.setFlag('ulei_golit', false);
    assert.equal(off.code, 'REQUIREMENTS');
    assert.ok(off.reasons.some((x) => x.includes('«Filtru ulei»')));
  });
});

describe('benchOnly', () => {
  test('nu se scoate pe motor, călătorește cu părintele, benchGroup', () => {
    const { sim } = fresh();
    const r = sim.remove('rotor_pompa_ulei');
    assert.equal(r.code, 'BENCH_ONLY');
    assert.deepEqual(sim.benchGroup('pompa_ulei'), ['rotor_pompa_ulei']);
    sim.loosen('pompa_ulei', 'tubulara_e10');
    const rp = sim.remove('pompa_ulei');
    assert.equal(rp.ok, true);
    assert.deepEqual(rp.data.group, ['rotor_pompa_ulei']);
    const rs = sim.getPartState('rotor_pompa_ulei');
    assert.equal(rs.installed, true);
    assert.equal(rs.onEngine, false);
    // pe banc se poate scoate și monta
    assert.equal(sim.remove('rotor_pompa_ulei').ok, true);
    assert.deepEqual(sim.benchGroup('pompa_ulei'), []);
    assert.equal(sim.install('rotor_pompa_ulei').ok, true);
    const ip = sim.install('pompa_ulei');
    assert.equal(ip.ok, true);
    assert.deepEqual(ip.data.group, ['rotor_pompa_ulei']);
    assert.equal(sim.isOnEngine('rotor_pompa_ulei'), true);
    // montare benchOnly cu părintele pe motor → refuz
    const { sim: s2 } = fresh({ enforce: false });
    s2.remove('rotor_pompa_ulei');
    s2.setEnforce(true);
    assert.equal(s2.install('rotor_pompa_ulei').code, 'BENCH_ONLY');
  });

  test('montare cu părinte lipsă → MOUNT_MISSING; deja montată → ALREADY_INSTALLED', () => {
    const { sim } = fresh();
    stripToCover(sim);
    sim.loosen('capac_chiulasa', 'tubulara_e10');
    sim.remove('capac_chiulasa');
    sim.remove('garnitura_capac_chiulasa');
    const r = sim.install('capac_chiulasa');
    assert.equal(r.code, 'MOUNT_MISSING');
    assert.match(r.message, /lipsește «Garnitură capac chiulasă»/);
    assert.equal(sim.install('bloc_motor').code, 'ALREADY_INSTALLED');
    assert.equal(sim.remove('capac_chiulasa').code, 'NOT_INSTALLED');
  });
});

describe('strângere', () => {
  const prepCover = () => {
    const { sim, events } = fresh();
    stripToCover(sim);
    sim.loosen('capac_chiulasa', 'tubulara_e10');
    sim.remove('capac_chiulasa');
    assert.equal(sim.install('capac_chiulasa').ok, true);
    assert.equal(sim.getPartState('capac_chiulasa').fasteners, 'loose');
    return { sim, events };
  };

  test('ok + avertisment NEVERIFICATĂ', () => {
    const { sim } = prepCover();
    const r = sim.tighten('capac_chiulasa', { toolId: 'cheie_dinamometrica_mica', torque: 10, order: [2, 4, 1, 3] });
    assert.equal(r.ok, true, r.message);
    assert.equal(r.code, 'OK');
    assert.ok(r.warnings.some((w) => w.includes('NEVERIFICATĂ')));
    assert.deepEqual(sim.getPartState('capac_chiulasa').torque, { status: 'ok', value: 10, angle: null, sequenceOk: true, toolId: 'cheie_dinamometrica_mica' });
  });

  test('under', () => {
    const { sim } = prepCover();
    const r = sim.tighten('capac_chiulasa', { toolId: 'cheie_dinamometrica_mica', torque: 5, order: [2, 4, 1, 3] });
    assert.equal(r.ok, false);
    assert.equal(r.code, 'TORQUE_UNDER');
    assert.equal(r.data.applied, true);
    assert.equal(sim.getPartState('capac_chiulasa').fasteners, 'tight');
    const fc = sim.finalCheck().data;
    assert.ok(fc.issues.some((i) => i.type === 'torque' && i.partId === 'capac_chiulasa'));
    assert.ok(fc.leaks.some((l) => l.partId === 'capac_chiulasa' && l.fluid === 'ulei'), 'capacul etanșează ulei prin garnitură');
  });

  test('over → piesă deteriorată + mesaj explicit', () => {
    const { sim } = prepCover();
    const r = sim.tighten('capac_chiulasa', { toolId: 'cheie_dinamometrica_mica', torque: 18, order: [2, 4, 1, 3] });
    assert.equal(r.code, 'TORQUE_OVER');
    assert.equal(r.message, 'Strângere excesivă: 18 Nm > maxim 11 Nm (valoare NEVERIFICATĂ, demonstrativă) — filet/garnitură deteriorate.');
    const st = sim.getPartState('capac_chiulasa');
    assert.equal(st.damaged, true);
    assert.equal(st.torque.status, 'over');
    assert.ok(sim.finalCheck().data.issues.some((i) => i.type === 'damaged'));
  });

  test('în afara domeniului cheii → TORQUE_RANGE, fără efect', () => {
    const { sim } = prepCover();
    const r = sim.tighten('capac_chiulasa', { toolId: 'cheie_dinamometrica', torque: 10, order: [2, 4, 1, 3] });
    assert.equal(r.code, 'TORQUE_RANGE');
    assert.equal(sim.getPartState('capac_chiulasa').fasteners, 'loose');
    assert.equal(sim.tighten('capac_chiulasa', { toolId: 'cheie_dinamometrica_mica' }).code, 'REQUIREMENTS');
    assert.equal(sim.tighten('capac_chiulasa', { toolId: 'tubulara_e8', torque: 10 }).code, 'WRONG_TOOL');
    assert.equal(sim.tighten('capac_chiulasa', { toolId: null, torque: 10 }).code, 'NO_TOOL');
  });

  test('uncontrolled (clichet/tubulară) — determinist din seed', () => {
    const a = prepCover().sim;
    const b = prepCover().sim;
    const ra = a.tighten('capac_chiulasa', { toolId: 'tubulara_e10', order: [2, 4, 1, 3] });
    const rb = b.tighten('capac_chiulasa', { toolId: 'tubulara_e10', order: [2, 4, 1, 3] });
    assert.equal(ra.code, 'UNCONTROLLED');
    assert.equal(a.getPartState('capac_chiulasa').torque.status, 'uncontrolled');
    assert.equal(ra.data.torque.value, rb.data.torque.value);
    assert.ok(a.finalCheck().data.issues.some((i) => i.type === 'torque'));
  });

  test('ordine greșită → sequenceOk false, problemă de etanșare', () => {
    const { sim } = prepCover();
    const r = sim.tighten('capac_chiulasa', { toolId: 'cheie_dinamometrica_mica', torque: 10, order: [1, 2, 3, 4] });
    assert.equal(r.code, 'SEQUENCE');
    assert.match(r.message, /2-4-1-3/);
    assert.equal(sim.getPartState('capac_chiulasa').torque.sequenceOk, false);
    const fc = sim.finalCheck().data;
    assert.ok(fc.issues.some((i) => i.type === 'sequence'));
    assert.ok(fc.leaks.some((l) => l.partId === 'capac_chiulasa'));
    // corectare: slăbește și strânge din nou
    assert.equal(sim.tighten('capac_chiulasa', { toolId: 'cheie_dinamometrica_mica', torque: 10, order: [2, 4, 1, 3] }).code, 'ALREADY_TIGHT');
    sim.loosen('capac_chiulasa', 'tubulara_e10');
    assert.equal(sim.tighten('capac_chiulasa', { toolId: 'cheie_dinamometrica_mica', torque: 10, order: [2, 4, 1, 3] }).ok, true);
  });

  test('unghi: lipsă → under, corect → ok, excesiv → over', () => {
    const { sim } = fresh();
    const prep = () => { sim.loosen('pompa_ulei', 'tubulara_e10'); };
    prep();
    let r = sim.tighten('pompa_ulei', { toolId: 'cheie_dinamometrica_mica', torque: 8 });
    assert.equal(r.code, 'TORQUE_UNDER');
    assert.match(r.message, /\+90°/);
    prep();
    r = sim.tighten('pompa_ulei', { toolId: 'cheie_dinamometrica_mica', torque: 8, angle: 90 });
    assert.equal(r.ok, true, r.message);
    prep();
    r = sim.tighten('pompa_ulei', { toolId: 'cheie_dinamometrica_mica', torque: 8, angle: 140 });
    assert.equal(r.code, 'TORQUE_OVER');
    assert.equal(sim.getPartState('pompa_ulei').damaged, true);
    assert.equal(sim.tighten('pompa_ulei', { toolId: 'unghiometru', torque: 8, angle: 90 }).code, 'ALREADY_TIGHT');
  });
});

describe('flux complet', () => {
  function fullCycle(sim, { newGasket = true } = {}) {
    stripToCover(sim);
    assert.equal(sim.loosen('capac_chiulasa', 'tubulara_e10').ok, true);
    const rc = sim.remove('capac_chiulasa');
    assert.equal(rc.ok, true, rc.message);
    assert.equal(sim.remove('garnitura_capac_chiulasa').ok, true);
    assert.equal(sim.loosen('bujie_1', 'cheie_bujii').ok, true);
    assert.equal(sim.remove('bujie_1').ok, true);
    // remontare
    assert.equal(sim.install('bujie_1', { newPart: true }).ok, true);
    assert.equal(sim.tighten('bujie_1', { toolId: 'cheie_dinamometrica', torque: 23 }).ok, true);
    const ig = sim.install('garnitura_capac_chiulasa', { newPart: newGasket });
    assert.equal(ig.ok, true);
    if (!newGasket) assert.ok(ig.warnings.some((w) => w.includes('unică folosință')));
    assert.equal(sim.install('capac_chiulasa').ok, true);
    assert.equal(sim.tighten('capac_chiulasa', { toolId: 'cheie_dinamometrica_mica', torque: 10, order: [2, 4, 1, 3] }).ok, true);
    for (const b of ['bobina_1', 'bobina_2']) {
      assert.equal(sim.install(b).ok, true);
      assert.equal(sim.tighten(b, { toolId: 'cheie_dinamometrica_mica', torque: 8 }).ok, true);
    }
    for (const c of ['conector_bobina_1', 'conector_bobina_2']) assert.equal(sim.connect(c).ok, true);
    assert.equal(sim.setFlag('baterie_deconectata', false, 'tubulara_10').ok, true);
  }

  test('demontare + remontare corectă → startable, fără probleme, costuri și manoperă', () => {
    const { sim, events } = fresh();
    fullCycle(sim);
    const r = sim.finalCheck();
    assert.equal(r.ok, true, r.reasons.join('\n'));
    assert.equal(r.data.startable, true);
    assert.deepEqual(r.data.issues, []);
    assert.deepEqual(r.data.leaks, []);
    assert.equal(r.data.sound.misfireCylinder, 0);
    assert.equal(sim.stats.errors, 0);
    assert.equal(sim.stats.partsCost, 80 + 60);
    assert.equal(sim.stats.laborMin, 2 * (3 + 3 + 20 + 5 + 4));
    // evenimente: sim:op urmat de sim:changed
    const i = events.findIndex(([e]) => e === 'sim:op');
    assert.equal(events[i + 1][0], 'sim:changed');
    assert.ok(events.some(([e, p]) => e === 'sim:log' && p.level === 'success' && typeof p.time === 'number'));
    assert.ok(events.some(([e, p]) => e === 'tool:active' && p.toolId === 'tubulara_10'));
  });

  test('garnitură refolosită → scurgere la verificarea finală', () => {
    const { sim } = fresh();
    fullCycle(sim, { newGasket: false });
    const r = sim.finalCheck();
    assert.equal(r.ok, false);
    assert.equal(r.data.startable, true);
    assert.ok(r.data.issues.some((i) => i.type === 'gasket' && i.partId === 'garnitura_capac_chiulasa'));
    assert.deepEqual(r.data.leaks, [{ partId: 'garnitura_capac_chiulasa', fluid: 'ulei' }]);
  });

  test('piese lipsă / conectori / flaguri / bobină lipsă → rateu', () => {
    const { sim } = fresh();
    stripToCover(sim);
    sim.install('bobina_2');
    const r = sim.finalCheck().data;
    assert.ok(r.issues.some((i) => i.type === 'missing' && i.partId === 'bobina_1'));
    assert.ok(r.issues.some((i) => i.type === 'fastener' && i.partId === 'bobina_2'));
    assert.ok(r.issues.some((i) => i.type === 'connector' && i.connectorId === 'conector_bobina_2'));
    assert.ok(r.issues.some((i) => i.type === 'flag' && i.flagId === 'baterie_deconectata'));
    assert.equal(r.sound.misfireCylinder, 1);
    assert.equal(r.startable, false);
    assert.equal(r.sound.noStart, true);
  });
});

describe('moduri și stare', () => {
  test('enforce false: fără condiții, fixare automată, fără greșeli; scurgere la demontare fără golire', () => {
    const { sim } = fresh({ enforce: false });
    const r = sim.remove('capac_chiulasa');
    assert.equal(r.ok, true, r.message);
    assert.deepEqual(r.data.group.sort(), ['bobina_1', 'bobina_2']);
    assert.equal(sim.getConnectorState('conector_bobina_1').connected, false);
    assert.equal(sim.isOnEngine('bobina_1'), false);
    const f = sim.remove('filtru_ulei');
    assert.equal(f.ok, true);
    assert.ok(f.warnings.some((w) => w.includes('scurgere de ulei pe podea')));
    assert.equal(sim.getFlag('ulei_golit'), true);
    assert.equal(sim.install('capac_chiulasa').ok, true);
    assert.equal(sim.getPartState('capac_chiulasa').fasteners, 'tight');
    assert.equal(sim.getConnectorState('conector_bobina_1').connected, true);
    assert.equal(sim.isOnEngine('bobina_1'), true);
    assert.equal(sim.install('capac_chiulasa').ok, false);
    assert.equal(sim.stats.errors, 0);
    assert.equal(sim.stats.mistakes.length, 0);
  });

  test('applyPreset: închidere tranzitivă, fără greșeli, un singur log', () => {
    const { sim, events } = fresh();
    const before = events.length;
    const r = sim.applyPreset({ removed: ['bujie_1'], flags: {} });
    assert.equal(r.ok, true);
    assert.equal(sim.isOnEngine('bujie_1'), false);
    assert.equal(sim.isOnEngine('bobina_1'), false);
    assert.equal(sim.getConnectorState('conector_bobina_1').connected, false);
    assert.equal(sim.isOnEngine('capac_chiulasa'), true);
    assert.equal(sim.getFlag('baterie_deconectata'), true, 'flagul cerut se setează automat');
    assert.equal(sim.stats.errors, 0);
    assert.equal(sim.stats.ops, 0);
    assert.equal(events.slice(before).filter(([e]) => e === 'sim:log').length, 1);
    const r2 = sim.applyPreset({ removed: ['garnitura_capac_chiulasa', 'rotor_pompa_ulei'], flags: { ulei_golit: true } });
    assert.deepEqual(r2.data.removed, ['bobina_2', 'capac_chiulasa', 'garnitura_capac_chiulasa', 'pompa_ulei', 'rotor_pompa_ulei']);
    assert.equal(sim.getFlag('ulei_golit'), true);
    // stare coerentă: se poate remonta în ordine inversă
    assert.equal(sim.install('garnitura_capac_chiulasa', { newPart: true }).ok, true);
    assert.equal(sim.install('capac_chiulasa').ok, true);
  });

  test('snapshot/restore JSON serializabil', () => {
    const { sim } = fresh();
    sim.setActiveTool('tubulara_e10');
    sim.loadFault('F_bobina_1');
    sim.loosen('capac_chiulasa');
    sim.remove('capac_chiulasa'); // greșeală
    const snap = JSON.parse(JSON.stringify(sim.snapshot()));
    const { sim: other } = fresh();
    assert.equal(other.restore(snap).ok, true);
    assert.equal(other.activeTool, 'tubulara_e10');
    assert.equal(other.activeFault, 'F_bobina_1');
    assert.equal(other.getPartState('capac_chiulasa').fasteners, 'loose');
    assert.equal(other.getPartState('bobina_1').damaged, true);
    assert.equal(other.stats.errors, 1);
    assert.deepEqual(other.snapshot(), sim.snapshot());
    sim.reset();
    assert.equal(sim.activeFault, null);
    assert.equal(sim.getPartState('capac_chiulasa').fasteners, 'tight');
    assert.equal(sim.stats.ops, 0);
  });

  test('determinismul seed-ului (cuplu necontrolat + măsurători)', () => {
    const run = (seed) => {
      const sim = new Simulator(FIXTURE, null, { seed });
      const vals = [];
      for (let i = 0; i < 3; i++) {
        sim.loosen('pompa_ulei', 'tubulara_e10');
        vals.push(sim.tighten('pompa_ulei', { toolId: 'tubulara_e10' }).data.torque.value);
      }
      sim.setFlag('baterie_deconectata', true, 'tubulara_10');
      vals.push(...sim.runTest('test_bobine', { toolId: 'multimetru' }).data.values);
      return vals;
    };
    assert.deepEqual(run(7), run(7));
    assert.notDeepEqual(run(7), run(8));
  });

  test('availableActions și dependencies', () => {
    const { sim } = fresh();
    const acts = sim.availableActions('bobina_1');
    const labels = acts.map((a) => a.label);
    assert.ok(labels.includes('Slăbește șurubul (1 × E8)'));
    assert.ok(labels.includes('Demontează'));
    assert.ok(labels.includes('Inspectează'));
    assert.ok(labels.some((l) => l.startsWith('Deconectează «Conector bobină cil. 1»')));
    const rem = acts.find((a) => a.action === 'remove');
    assert.equal(rem.allowed, false);
    assert.ok(rem.reasons.length >= 3);
    assert.equal(sim.stats.errors, 0, 'availableActions nu numără greșeli');
    const d = sim.dependencies('capac_chiulasa');
    assert.deepEqual(d.mounts.map((m) => m.id), ['garnitura_capac_chiulasa']);
    assert.equal(d.torqueSpec.id, 'spec_cuplu_capac');
    assert.equal(d.sequenceSpec.id, 'spec_ordine_capac');
    assert.deepEqual(d.flags.map((f) => [f.id, f.ok]), [['baterie_deconectata', false]]);
    sim.applyPreset({ removed: ['bobina_1'] });
    const a2 = sim.availableActions('bobina_1').map((a) => a.action);
    assert.ok(a2.includes('install') && a2.includes('install_new') && a2.includes('connect'));
  });
});

describe('diagnostic', () => {
  test('measure: cerințe, sculă, valoare nominală vs defect', () => {
    const { sim } = fresh();
    assert.equal(sim.measure('capac_chiulasa', 'planeitate', 'rigla_lera').code, 'REQUIREMENTS');
    stripToCover(sim);
    sim.loosen('capac_chiulasa', 'tubulara_e10');
    sim.remove('capac_chiulasa');
    assert.equal(sim.measure('capac_chiulasa', 'planeitate', 'multimetru').code, 'WRONG_TOOL');
    const ok = sim.measure('capac_chiulasa', 'planeitate', 'rigla_lera');
    assert.equal(ok.ok, true);
    assert.equal(ok.data.inTolerance, true);
    assert.ok(ok.data.value >= 0 && ok.data.value <= 0.05);
    assert.equal(ok.data.unit, 'mm');
    assert.ok(ok.warnings.some((w) => w.includes('NEVERIFICATĂ')));
    sim.loadFault('F_bobina_1');
    const bad = sim.measure('capac_chiulasa', 'planeitate', 'rigla_lera');
    assert.equal(bad.data.value, 0.12);
    assert.equal(bad.data.inTolerance, false);
    assert.equal(bad.data.status, 'high');
    assert.equal(sim.perform('measure', 'capac_chiulasa.planeitate', { toolId: 'rigla_lera' }).data.value, 0.12);
  });

  test('runTest cu defect, inspect, diagnose, reparare', () => {
    const { sim } = fresh();
    const lf = sim.loadFault('F_bobina_1');
    assert.equal(lf.ok, true);
    assert.equal(sim.activeFault, 'F_bobina_1');
    assert.equal(sim.getPartState('bobina_1').damaged, true);
    assert.equal(sim.runTest('test_bobine', { toolId: 'multimetru' }).code, 'REQUIREMENTS');
    sim.setFlag('baterie_deconectata', true, 'tubulara_10');
    assert.equal(sim.runTest('test_bobine', { toolId: 'tubulara_10' }).code, 'WRONG_TOOL');
    const t = sim.runTest('test_bobine', { toolId: 'multimetru' });
    assert.deepEqual(t.data.values, [5, 0.6, 0.6, 0.6]);
    assert.deepEqual(t.data.inTolerance, [false, true, true, true]);
    const ins = sim.inspect('bobina_1');
    assert.ok(ins.data.findings.some((f) => f.defect && f.text.includes('Fisură')));
    let fc = sim.finalCheck().data;
    assert.ok(fc.issues.some((i) => i.type === 'fault'));
    assert.equal(fc.sound.misfireCylinder, 1);
    assert.ok(fc.sound.roughness >= 0.4);
    const d1 = sim.diagnose(['bobina_1', 'bujie_1']);
    assert.equal(d1.ok, false);
    assert.equal(d1.data.score, 50);
    assert.deepEqual(d1.data.wrong, ['bujie_1']);
    const d2 = sim.diagnose(['bobina_1']);
    assert.equal(d2.ok, true);
    assert.equal(d2.data.score, 100);
    assert.equal(sim.diagnose([]).data.score, 0);
    // reparare: înlocuire cu piesă nouă
    sim.disconnect('conector_bobina_1');
    sim.loosen('bobina_1', 'tubulara_e8');
    sim.remove('bobina_1');
    sim.install('bobina_1', { newPart: true });
    sim.tighten('bobina_1', { toolId: 'cheie_dinamometrica_mica', torque: 8 });
    sim.connect('conector_bobina_1');
    sim.setFlag('baterie_deconectata', false, 'tubulara_10');
    assert.equal(sim.faultRepaired, true);
    fc = sim.finalCheck();
    assert.equal(fc.ok, true, fc.reasons.join('\n'));
    sim.setFlag('baterie_deconectata', true, 'tubulara_10');
    const t2 = sim.runTest('test_bobine', { toolId: 'multimetru' });
    assert.ok(t2.data.inTolerance.every(Boolean));
    sim.loadFault(null);
    assert.equal(sim.activeFault, null);
    assert.equal(sim.diagnose(['bobina_1']).code, 'NO_FAULT');
  });

  test('loadFault(null) anulează deteriorarea din defect', () => {
    const { sim } = fresh();
    sim.loadFault('F_bobina_1');
    sim.loadFault(null);
    assert.equal(sim.getPartState('bobina_1').damaged, false);
    assert.equal(sim.loadFault('nu_exista').code, 'UNKNOWN');
  });
});
