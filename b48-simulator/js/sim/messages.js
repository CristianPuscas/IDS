/**
 * Texte în română pentru simulator. Toate mesajele folosesc numele pieselor/sculelor (nu doar ID-urile).
 * Formulările sunt neutre ca gen („piesa …”) ca să se potrivească oricărui nume de piesă.
 */

export const q = (s) => `«${s}»`;

/** „A”, „A și B”, „A, B și C” (cu ghilimele «»). */
export function list(names, conj = 'și') {
  const items = names.map(q);
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} ${conj} ${items[items.length - 1]}`;
}

/** Număr formatat românește (virgulă zecimală). */
export function num(v, decimals = null) {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  const n = Number(v);
  const s = decimals == null ? String(Math.round(n * 1000) / 1000) : n.toFixed(decimals);
  return s.replace('.', ',');
}

/** Interval „9–11 Nm”. */
export function range(min, max, unit = '') {
  const u = unit ? ` ${unit}` : '';
  if (min != null && max != null) return `${num(min)}–${num(max)}${u}`;
  if (min != null) return `≥ ${num(min)}${u}`;
  if (max != null) return `≤ ${num(max)}${u}`;
  return '—';
}

export const FLUID_NAMES = {
  ulei: 'ulei',
  lichid_racire: 'lichid de răcire',
  aer: 'aer (admisie/supraalimentare)',
  gaze_evacuare: 'gaze de evacuare',
  combustibil: 'combustibil'
};
export const fluidName = (f) => FLUID_NAMES[f] || String(f);

/** Eticheta de status a unei specificații, ex. „(valoare NEVERIFICATĂ, demonstrativă)”. */
export function specTag(spec) {
  if (!spec) return '(fără specificație)';
  if (spec.status === 'VERIFICATĂ') return '(valoare VERIFICATĂ)';
  return spec.demo ? '(valoare NEVERIFICATĂ, demonstrativă)' : '(valoare NEVERIFICATĂ)';
}

/** Avertisment standard pentru specificațiile neverificate (null dacă e verificată). */
export function specWarning(spec) {
  if (!spec || spec.status === 'VERIFICATĂ') return null;
  return `Specificația ${q(spec.name || spec.id)} este NEVERIFICATĂ${spec.demo ? ' (valoare demonstrativă, inventată pentru simulator)' : ''} — nu o folosi pe un motor real.`;
}

/** Substantivul pentru elementele de fixare, acordat cu numărul. */
const FASTENER_NOUNS = {
  'șurub': { sg: 'Șurubul', pl: 'Șuruburile', f: false },
  'surub': { sg: 'Șurubul', pl: 'Șuruburile', f: false },
  'piuliță': { sg: 'Piulița', pl: 'Piulițele', f: true },
  'piulita': { sg: 'Piulița', pl: 'Piulițele', f: true },
  'prezon': { sg: 'Prezonul', pl: 'Prezoanele', f: false },
  'colier': { sg: 'Colierul', pl: 'Colierele', f: false },
  'clemă': { sg: 'Clema', pl: 'Clemele', f: true },
  'clema': { sg: 'Clema', pl: 'Clemele', f: true },
  'bujie': { sg: 'Filetul bujiei', pl: 'Filetele', f: false },
  'buson': { sg: 'Bușonul', pl: 'Bușoanele', f: false },
  'bușon': { sg: 'Bușonul', pl: 'Bușoanele', f: false }
};

export function fastenerWords(fasteners) {
  const count = fasteners?.count ?? 1;
  const key = String(fasteners?.type || '').toLowerCase().trim();
  const n = FASTENER_NOUNS[key] || FASTENER_NOUNS[key.split(/\s+/)[0]] || { sg: 'Elementul de fixare', pl: 'Elementele de fixare', f: false };
  const plural = count !== 1;
  const noun = plural ? n.pl : n.sg;
  const size = fasteners?.size ? ` × ${fasteners.size}` : '';
  const detail = `(${count}${size})`;
  return {
    noun, // „Șuruburile”
    nounLower: noun.charAt(0).toLowerCase() + noun.slice(1),
    detail, // „(14 × E10)”
    loosened: plural ? 'slăbite' : (n.f ? 'slăbită' : 'slăbit'),
    tightened: plural ? 'strânse' : (n.f ? 'strânsă' : 'strâns'),
    be: plural ? 'sunt' : 'este'
  };
}

export const ACTION_NAMES = {
  disconnect: 'Deconectare', connect: 'Conectare', loosen: 'Slăbire', remove: 'Demontare', install: 'Montare',
  install_new: 'Montare piesă nouă', tighten: 'Strângere', flag_on: 'Pregătire', flag_off: 'Pregătire',
  set_flag: 'Pregătire', inspect: 'Inspecție', measure: 'Măsurare', test: 'Test', final_check: 'Verificare finală',
  diagnose: 'Diagnostic', load_fault: 'Scenariu defect', preset: 'Stare inițială', reset: 'Resetare'
};

/** Toate textele parametrizate. Primesc nume (nu ID-uri), deja rezolvate. */
export const T = {
  unknownPart: (id) => `Piesă necunoscută: „${id}”.`,
  unknownTool: (id) => `Sculă necunoscută: „${id}”.`,
  unknownConnector: (id) => `Conector necunoscut: „${id}”.`,
  unknownFlag: (id) => `Condiție de pregătire necunoscută: „${id}”.`,
  unknownTest: (id) => `Test necunoscut: „${id}”.`,
  unknownFault: (id) => `Scenariu de defect necunoscut: „${id}”.`,
  unknownMeasurement: (p, id) => `${q(p)} nu are măsurătoarea „${id}”.`,
  unknownAction: (a) => `Acțiune necunoscută: „${a}”.`,

  notInstalled: (p) => `${q(p)}: piesa nu este montată.`,
  alreadyInstalled: (p) => `${q(p)}: piesa este deja montată.`,

  benchOnlyRemove: (p, parents) => `${q(p)} se demontează doar pe banc: mai întâi scoate de pe motor ${list(parents)}.`,
  benchOnlyInstall: (p, parents) => `${q(p)} se montează doar pe banc: ${list(parents)} trebuie să fie scoasă de pe motor.`,
  reasonRemoveFromEngine: (b) => `Scoate de pe motor ${q(b)} (piesa se lucrează pe banc).`,

  blockedRemove: (p, blockers) => `Nu poți demonta ${q(p)}: mai întâi demontează ${list(blockers)}.`,
  reasonRemove: (b) => `Demontează ${q(b)}.`,
  blockedInstall: (p, blockers) => `Nu poți monta ${q(p)} cât timp pe motor se află ${list(blockers)} — piesa ar fi blocată.`,

  mountMissing: (p, parents) => `Nu poți monta ${q(p)}: lipsește ${list(parents)}.`,
  reasonInstall: (x) => `Montează mai întâi ${q(x)}.`,

  connected: (c) => `Conectorul ${q(c)} este încă conectat.`,
  connectedMany: (cs) => `Conectorii ${list(cs)} sunt încă conectați.`,
  reasonDisconnect: (c) => `Deconectează ${q(c)}.`,
  connectorAlreadyConnected: (c) => `Conectorul ${q(c)} este deja conectat.`,
  connectorAlreadyDisconnected: (c) => `Conectorul ${q(c)} este deja deconectat.`,
  connectorEndMissing: (c, parts) => `Conectorul ${q(c)} nu poate fi conectat: ${list(parts)} nu este montată pe motor.`,
  connectedOk: (c) => `Conectorul ${q(c)} a fost conectat (clipsul de siguranță s-a închis).`,
  disconnectedOk: (c) => `Conectorul ${q(c)} a fost deconectat. Trage de corpul conectorului, nu de fire.`,

  fastened: (w) => `${w.noun} ${w.detail} nu ${w.be} ${w.loosened}.`,
  reasonLoosen: (w, tools) => `Slăbește ${w.nounLower} ${w.detail}${tools.length ? ` cu ${list(tools, 'sau')}` : ''}.`,
  noFasteners: (p) => `${q(p)} nu are elemente de fixare (se scoate/montează direct).`,
  alreadyLoose: (p, w) => `${q(p)}: ${w.nounLower} ${w.detail} ${w.be} deja ${w.loosened}.`,
  alreadyTight: (p, w) => `${q(p)}: ${w.nounLower} ${w.detail} ${w.be} deja ${w.tightened}. Slăbește-le înainte de a strânge din nou.`,
  loosenedOk: (p, w, tool) => `${q(p)}: ${w.nounLower} ${w.detail} au fost ${w.loosened}${tool ? ` cu ${q(tool)}` : ''}.`,

  flagRequired: (flagName, label) => `Condiție nesatisfăcută: ${q(flagName)} trebuie să fie activă${label ? ` („${label}”)` : ''}.`,
  flagMustBeOff: (flagName, label) => `Condiție nesatisfăcută: ${q(flagName)} trebuie să fie inactivă${label ? ` („${label}”)` : ''}.`,
  reasonFlagOn: (flagName, label) => label ? `${label} (${q(flagName)}).` : `Activează ${q(flagName)}.`,
  reasonFlagOff: (flagName, label) => label ? `${label} (${q(flagName)}).` : `Dezactivează ${q(flagName)}.`,

  noTool: (needed) => `Nicio sculă selectată. Necesar: ${list(needed, 'sau')}.`,
  wrongTool: (tool, needed) => `Sculă incorectă: ${q(tool)} nu se potrivește. Necesar: ${list(needed, 'sau')}.`,
  reasonChooseTool: (needed) => `Alege ${list(needed, 'sau')}.`,
  torqueToolNotForLoosen: (tool) => `${q(tool)} nu se folosește la slăbire — cheia dinamometrică se folosește doar la strângere (se decalibrează).`,

  removedOk: (p) => `${q(p)} a fost demontată.`,
  removedOkGroup: (p, group) => `${q(p)} a fost demontată împreună cu ${list(group)} (se lucrează pe banc).`,
  installedOk: (p, isNew) => `${q(p)} a fost montată${isNew ? ' (piesă nouă)' : ' (piesă refolosită)'}.`,
  installedNextStep: (w) => `Urmează strângerea: ${w.nounLower} ${w.detail} ${w.be} doar puse, ne${w.tightened}.`,
  reusedGasket: (p) => `Atenție: ${q(p)} este de unică folosință și a fost deja folosită. Montată din nou nu etanșează sigur — folosește o piesă nouă.`,
  reusedDamaged: (p, note) => `Atenție: montezi ${q(p)} deteriorată${note ? ` (${note})` : ''}.`,
  connectorsStayDisconnected: (cs) => `Nu uita să reconectezi ${list(cs)}.`,
  spill: (p, fluid, flagName) => `Atenție: ${q(p)} a fost demontată fără golire — scurgere de ${fluidName(fluid)} pe podea!${flagName ? ` (${q(flagName)} a fost marcat automat.)` : ''}`,
  freeModeAuto: () => 'Modul liber: elementele de fixare și conectorii au fost tratați automat.',

  noTorqueValue: () => 'Introdu valoarea cuplului (Nm) pentru cheia dinamometrică.',
  torqueOutOfToolRange: (tool, torque, min, max) => `Cuplul ${num(torque)} Nm este în afara domeniului cheii ${q(tool)} (${range(min, max, 'Nm')}). Alege altă cheie dinamometrică.`,
  wrongTightenTool: (tool, needed) => `Sculă incorectă pentru strângere: ${q(tool)}. Folosește o cheie dinamometrică${needed.length ? ` (sau, fără cuplu controlat, ${list(needed, 'sau')})` : ''}.`,
  angleToolHint: () => 'Unghiometrul se folosește după strângerea la cuplu: alege cheia dinamometrică și indică unghiul în pasul de strângere.',
  torqueUnder: (t, min, tag) => `Cuplu insuficient: ${num(t)} Nm < minim ${num(min)} Nm ${tag} — risc de slăbire și scurgeri.`,
  torqueOver: (t, max, tag) => `Strângere excesivă: ${num(t)} Nm > maxim ${num(max)} Nm ${tag} — filet/garnitură deteriorate.`,
  angleMissing: (a, tag) => `Lipsește strângerea unghiulară: specificația cere încă +${num(a)}° ${tag}.`,
  angleUnder: (a, need, tag) => `Unghi insuficient: +${num(a)}° < +${num(need)}° ${tag}.`,
  angleOver: (a, need, tag) => `Unghi excesiv: +${num(a)}° > +${num(need)}° ${tag} — șurub alungit/filet deteriorat.`,
  uncontrolled: (p, tool, approx, spec) => `${q(p)} strânsă cu ${q(tool)}, fără cuplu controlat (≈${num(approx)} Nm, necunoscut). Necesar: ${num(spec.value)} Nm (${range(spec.min, spec.max, 'Nm')}) ${specTag(spec)} cu cheia dinamometrică.`,
  sequenceWrong: (used, expected, tag) => `Ordine de strângere greșită: ${used ? used.join('-') : 'neindicată'}; ordinea cerută este ${expected.join('-')} ${tag} — risc de deformare și scurgeri.`,
  tightenedOk: (p, t, spec, seq) => `${q(p)} strânsă corect: ${num(t)} Nm${spec ? ` (${range(spec.min, spec.max, 'Nm')})` : ''}${spec?.angle != null ? ` + ${num(spec.angle)}°` : ''}${seq ? ', în ordinea corectă' : ''}.`,
  tightenedPlain: (p) => `${q(p)} a fost fixată.`,
  noTorqueSpec: (p) => `Fără specificație de cuplu pentru ${q(p)} — strângere fără valoare de referință.`,
  reasonRetighten: () => 'Slăbește și strânge din nou cu cheia dinamometrică, la valoarea și în ordinea prescrise.',

  flagNoChange: (f, v) => `${q(f)} este deja ${v ? 'activă' : 'inactivă'}.`,
  flagSet: (f, v, label) => `${label ? `${label}: efectuat` : `${q(f)} a fost ${v ? 'activată' : 'dezactivată'}`} (${q(f)} ${v ? 'activă' : 'inactivă'}).`,
  reqNeedRemoved: (p) => `Demontează ${q(p)}.`,
  reqNeedInstalled: (p) => `Montează ${q(p)}.`,
  reqNotMet: (what) => `Condiții nesatisfăcute pentru ${q(what)}.`,
  freeModeIgnored: (rs) => `Modul liber: condiții ignorate — ${rs.join(' ')}`,

  inspectNeedsRemoved: (p) => `Pentru inspecție, ${q(p)} trebuie demontată de pe motor.`,
  inspectDone: (p, n) => `Inspecție ${q(p)}: ${n ? `${n} ${n === 1 ? 'anomalie găsită' : 'anomalii găsite'}` : 'fără anomalii'}.`,
  measureNeedsRemoved: (p) => `Pentru această măsurătoare, ${q(p)} trebuie demontată de pe motor.`,
  noSpec: () => 'Fără specificație — valoarea nu poate fi comparată.',
  measured: (p, m, v, unit, ok, spec) => `${q(p)} — ${m}: ${num(v)} ${unit || ''}`.trim() + (spec ? ` (admis ${range(spec.min, spec.max, unit)}) — ${ok ? 'în toleranță' : 'ÎN AFARA toleranței'}.` : '.'),
  testVariantInvalid: (t, v, vs) => `${q(t)} nu are varianta „${v}”. Variante: ${vs.join(', ')}.`,
  testDone: (t, variant, summary) => `${q(t)}${variant ? ` (${variant})` : ''}: ${summary}`,

  faultLoaded: () => 'Scenariu de defect încărcat. Observă simptomele și efectuează verificările.',
  faultCleared: () => 'Niciun defect activ.',
  noFault: () => 'Nu există un defect activ de diagnosticat.',
  diagnoseOk: (score) => `Diagnostic corect! Scor ${score}/100.`,
  diagnosePartial: (score, missed, wrong) => `Diagnostic incomplet: scor ${score}/100.${missed.length ? ` Ai omis ${list(missed)}.` : ''}${wrong.length ? ` Nu sunt cauza: ${list(wrong)}.` : ''}`,

  toolActive: (t) => `Sculă activă: ${q(t)}.`,
  toolNone: () => 'Nicio sculă activă (mâinile libere).',
  presetApplied: (n, names) => `Stare inițială aplicată: ${n} ${n === 1 ? 'piesă demontată' : 'piese demontate'}${names.length ? ` (${names.slice(0, 6).join(', ')}${names.length > 6 ? ', …' : ''})` : ''}.`,
  resetDone: () => 'Motorul a fost readus la starea inițială (complet asamblat).',
  restored: () => 'Starea salvată a fost restaurată.',

  // Verificare finală
  fcMissing: (p) => `Lipsește ${q(p)} — piesa nu este montată.`,
  fcLoose: (p, w) => `${q(p)}: ${w.nounLower} ${w.detail} nu ${w.be} ${w.tightened}.`,
  fcUnder: (p, t) => `${q(p)}: strânsă sub cuplul prescris${t != null ? ` (${num(t)} Nm)` : ''} — se poate slăbi, risc de scurgeri.`,
  fcOver: (p, t) => `${q(p)}: strângere excesivă${t != null ? ` (${num(t)} Nm)` : ''} — filet/garnitură deteriorate.`,
  fcUncontrolled: (p) => `${q(p)}: strânsă fără cheie dinamometrică (cuplu necontrolat).`,
  fcSequence: (p) => `${q(p)}: ordinea de strângere nu a fost respectată — risc de deformare și scurgeri.`,
  fcConnector: (c) => `Conectorul ${q(c)} este deconectat.`,
  fcTimingLocked: (f) => `AVARIE GRAVĂ: ${q(f)} — sculele de blocare a distribuției sunt încă montate! Pornirea ar rupe sculele/lanțul și ar distruge motorul.`,
  fcFlagOn: (f, label) => `${q(f)} este încă activă${label ? ` — „${label}” înainte de pornire` : ''}.`,
  fcNoOil: (f, label) => `Motorul nu are ulei (${q(f)})${label ? ` — „${label}”` : ''}. Pornirea fără ulei distruge lagărele.`,
  fcNoCoolant: (f, label) => `Sistemul de răcire este gol (${q(f)})${label ? ` — „${label}”` : ''}. Pornirea fără lichid duce la supraîncălzire.`,
  fcGasket: (p, fluid) => `${q(p)} (de unică folosință) a fost refolosită — se va produce o scurgere${fluid ? ` de ${fluidName(fluid)}` : ''}.`,
  fcDamaged: (p, note) => `${q(p)} este deteriorată${note ? `: ${note}` : ''}.`,
  fcFault: () => 'Simptomele persistă: defectul inițial nu a fost remediat.',
  fcOk: () => 'Verificare finală: motorul pornește și funcționează normal. Nicio problemă găsită.',
  fcIssues: (n, startable) => `Verificare finală: ${n} ${n === 1 ? 'problemă găsită' : 'probleme găsite'}${startable ? '' : ' — motorul NU poate fi pornit'}.`,
  fcLeak: (p, fluid) => `Scurgere de ${fluidName(fluid)} la ${q(p)}.`
};
