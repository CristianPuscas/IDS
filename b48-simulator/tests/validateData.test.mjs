import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { validateData } from '../js/core/validateData.js';

const load = () => JSON.parse(readFileSync(fileURLToPath(new URL('./fixtures/mini.json', import.meta.url)), 'utf8'));

describe('validateData', () => {
  test('fixture-ul mini nu are erori', () => {
    const { errors, warnings } = validateData(load());
    assert.deepEqual(errors, []);
    assert.ok(Array.isArray(warnings));
  });

  test('date stricate → erori pentru referințe, duplicate, cicluri, status', () => {
    const d = load();
    const P = d.parts.parts;
    P.push({ ...P[0] }); // ID duplicat
    P.find((p) => p.id === 'bobina_1').mountsOn = ['capac_inexistent'];
    P.find((p) => p.id === 'bujie_1').blockedBy = ['nimic'];
    P.find((p) => p.id === 'capac_chiulasa').fasteners.tools = ['scula_fantoma'];
    P.find((p) => p.id === 'capac_chiulasa').fasteners.torqueSpec = 'spec_fantoma';
    P.find((p) => p.id === 'pompa_ulei').sealsFluid = 'apa';
    // ciclu: bloc_motor pe rotor (rotor → pompa → bloc → rotor)
    P.find((p) => p.id === 'bloc_motor').mountsOn = ['rotor_pompa_ulei'];
    d.parts.connectors[0].between = ['bobina_1', 'cablu_fantoma'];
    d.specs.specs[0].status = 'VERIFICATĂ'; // fără sursă
    d.specs.specs.push({ id: 'spec_rau', name: 'Rău', type: 'torque', value: 5, min: 9, max: 3, status: 'POATE', demo: true });
    d.tests.tests[0].tool = 'scula_fantoma';
    d.faults.faults[0].rootCauseParts = ['piesa_fantoma'];
    d.faults.faults[0].measurements = { 'capac_chiulasa.nu_exista': 1 };
    d.lessons.lessons[0].steps.push({ id: 't9', type: 'action', action: 'remove', target: 'piesa_fantoma', text: '' });
    d.lessons.lessons[0].steps.push({ id: 't9', type: 'quiz', question: '?', options: ['a', 'b'], answer: 5 });
    d.flags.flags[0].toolsOn = ['scula_fantoma'];
    d.variants.selected = 'B99';
    const { errors } = validateData(d);
    const has = (re) => assert.ok(errors.some((e) => re.test(e)), `lipsește eroarea ${re}\n${errors.join('\n')}`);
    has(/ID duplicat „bloc_motor”/);
    has(/bobina_1.*mountsOn.*capac_inexistent/);
    has(/bujie_1.*blockedBy.*nimic/);
    has(/fasteners\.tools.*scula_fantoma/);
    has(/torqueSpec.*spec_fantoma/);
    has(/sealsFluid.*apa/);
    has(/Ciclu în „mountsOn”/);
    has(/conector_bobina_1.*cablu_fantoma/);
    has(/spec_cuplu_capac.*VERIFICATĂ fără document/);
    has(/spec_rau.*min \(9\) > max \(3\)/);
    has(/spec_rau.*status/);
    has(/test_bobine.*scula_fantoma/);
    has(/F_bobina_1.*piesa_fantoma/);
    has(/nu are măsurătoarea „nu_exista”/);
    has(/L_T.*piesa_fantoma/);
    has(/ID de pas duplicat „t9”/);
    has(/answer/);
    has(/baterie_deconectata.*toolsOn.*scula_fantoma/);
    has(/B99/);
  });

  test('blocaj circular și date care nu sunt obiect', () => {
    const d = load();
    d.parts.parts.find((p) => p.id === 'bobina_1').blockedBy = ['garnitura_capac_chiulasa']; // bobină → garnitură → capac → bobină
    assert.ok(validateData(d).errors.some((e) => e.includes('Blocaj circular')));
    assert.ok(validateData(null).errors.length > 0);
    assert.ok(validateData({}).errors.some((e) => e.includes('parts')));
  });
});
