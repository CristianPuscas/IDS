/**
 * Chestionar (întrebări de verificare / test final de lecție). O întrebare pe ecran, explicație după răspuns.
 * Întoarce { correct, total, score (0-100), answers } sau null dacă a fost abandonat.
 */
import { h } from './dom.js';
import { openModal } from './modal.js';

export function openQuizDialog(app, { title = 'Test', questions = [], intro = '' } = {}) {
  const qs = (questions || []).filter((q) => q && Array.isArray(q.options) && q.options.length);
  if (!qs.length) return Promise.resolve({ correct: 0, total: 0, score: 100, answers: [] });
  let idx = 0; let correct = 0;
  const answers = [];
  const content = h('div.quiz');
  const m = openModal({ title, size: 'md', body: content, actions: [] });

  const showQuestion = () => {
    const q = qs[idx];
    const fb = h('div.feedback', { 'aria-live': 'polite' });
    const opts = h('div.quiz-options', { role: 'group', 'aria-label': 'Variante de răspuns' });
    q.options.forEach((o, i) => {
      const b = h('button.btn.btn-block.quiz-opt', { type: 'button' }, `${String.fromCharCode(65 + i)}. ${o}`);
      b.addEventListener('click', () => {
        const ok = i === q.answer;
        answers.push({ index: idx, chosen: i, ok });
        if (ok) correct++;
        app.score?.record('quiz', ok);
        [...opts.children].forEach((c, j) => {
          c.disabled = true;
          if (j === q.answer) c.classList.add('correct');
          else if (j === i) c.classList.add('wrong');
        });
        fb.className = `feedback ${ok ? 'feedback-ok' : 'feedback-bad'}`;
        fb.textContent = `${ok ? 'Corect.' : `Greșit — răspunsul corect: ${String.fromCharCode(65 + q.answer)}.`} ${q.explanation || ''}`;
        if (ok) app.audio.success(); else app.audio.error();
        m.setActions([{ label: idx + 1 < qs.length ? 'Următoarea întrebare' : 'Vezi rezultatul', kind: 'primary', autofocus: true,
          onClick: () => { idx++; if (idx < qs.length) showQuestion(); else showSummary(); return false; } }]);
      });
      opts.appendChild(b);
    });
    content.replaceChildren(
      intro && idx === 0 ? h('p.muted', intro) : null,
      h('div.quiz-progress', `Întrebarea ${idx + 1} din ${qs.length}`),
      h('p.quiz-q', q.question), opts, fb);
    m.setActions([{ label: 'Abandonează', value: null }]);
    setTimeout(() => opts.firstChild?.focus(), 40);
  };

  const showSummary = () => {
    const score = Math.round((correct / qs.length) * 100);
    content.replaceChildren(
      h('div.quiz-summary', h('div.big', `${score}%`), h('p', `${correct} răspunsuri corecte din ${qs.length}.`),
        h('p.muted', score >= 70 ? 'Felicitări — test promovat.' : 'Recomandare: reluați lecția și încercați din nou.')));
    m.setActions([{ label: 'Închide', kind: 'primary', autofocus: true, value: { correct, total: qs.length, score, answers } }]);
  };

  showQuestion();
  return m.result.then((v) => (v && typeof v === 'object' ? v : null));
}
