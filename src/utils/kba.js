/**
 * Lightweight knowledge-based verification (KBA) for identity mapping. Generates a few multiple-choice
 * questions from the member's OWN record, so a claimant must demonstrate knowledge only the real person
 * should have — a former city, a relative, a past employer. Correct answers come from the record; decoys
 * come from fixed pools (never the real values).
 *
 * LOW-ASSURANCE BY DESIGN. Public-record KBA is friction + signal, not proof: the correct answers and the
 * decoys are drawn from the same public data an attacker could look up (NIST 800-63 dropped KBA as an
 * authenticator). The optional DL-barcode scan is the stronger step; this is the lightweight, non-gating one.
 */
import { extractAll } from './reportExtract';

const CITY_POOL = ['Portland, OR', 'Austin, TX', 'Columbus, OH', 'Nashville, TN', 'Tucson, AZ', 'Raleigh, NC',
  'Omaha, NE', 'Boise, ID', 'Albany, NY', 'Fresno, CA', 'Toledo, OH', 'Akron, OH', 'Reno, NV', 'Spokane, WA',
  'Mobile, AL', 'Dayton, OH', 'Chattanooga, TN', 'Lubbock, TX'];
const FIRST_NAMES = ['Michael', 'Susan', 'David', 'Linda', 'James', 'Patricia', 'Robert', 'Karen', 'Daniel',
  'Nancy', 'Thomas', 'Barbara', 'Christopher', 'Sandra', 'Kevin', 'Donna'];
const EMPLOYER_POOL = ['Aetna', 'UPS', 'Kroger', 'Wells Fargo', 'The Home Depot', 'Verizon', 'Target', 'FedEx',
  'Comcast', "Lowe's", 'CVS Health', 'Walgreens'];
const STATE_POOL = ['CA', 'TX', 'FL', 'NY', 'PA', 'IL', 'OH', 'GA', 'NC', 'MI', 'WA', 'AZ', 'CO', 'OR', 'NV', 'TN'];

function shuffle(a) {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; }
  return r;
}
const low = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
function pickDecoys(pool, exclude, n) {
  const ex = new Set((exclude || []).map(low));
  return shuffle(pool.filter((p) => !ex.has(low(p)))).slice(0, n);
}
function opts(correct, decoys) {
  return shuffle([{ label: correct, correct: true }, ...decoys.map((d) => ({ label: d, correct: false }))]);
}
function surnameOf(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : '';
}

/**
 * Build up to `max` KBA questions. Prefers rich record facts (past city, relative, employer) from the
 * report; falls back to a coarse state-recall question when only the thin self-identify record is available.
 * @returns {Array<{id, prompt, options:[{label, correct}]}>}
 */
export function generateKba(report, selfPerson, max = 2) {
  const q = [];
  let x = null;
  try { x = report ? extractAll(report) : null; } catch { x = null; }

  if (x) {
    // Past city — from address history, skipping the current/first address (that's visible on the card).
    const cities = [...new Set((x.addresses || []).slice(1)
      .map((a) => [a.city, a.state].filter(Boolean).join(', ')).filter(Boolean))];
    if (cities.length) {
      q.push({ id: 'past_city', prompt: 'Which of these places have you lived?',
        options: opts(cities[0], pickDecoys(CITY_POOL, cities, 3)) });
    }
    // Relative — decoys share the member's surname so the test is genuinely on the relative's first name,
    // not "pick the one with my last name."
    const rels = [...new Set((x.relatives || []).map((r) => r.name).filter(Boolean))];
    if (rels.length && q.length < max) {
      const surname = surnameOf(selfPerson && selfPerson.name);
      const decoyNames = pickDecoys(FIRST_NAMES, [surnameOf(rels[0])], 3).map((f) => surname ? `${f} ${surname}` : f);
      q.push({ id: 'relative', prompt: 'Which of these people is related to you?',
        options: opts(rels[0], decoyNames) });
    }
    // Past employer.
    const emps = [...new Set((x.jobs || []).map((j) => j.employer).filter(Boolean))];
    if (emps.length && q.length < max) {
      q.push({ id: 'employer', prompt: 'Which of these have you worked for?',
        options: opts(emps[0], pickDecoys(EMPLOYER_POOL, emps, 3)) });
    }
  }

  // Fallback (no/thin report) — coarse state recall from the selected record. Weakest question; used only
  // so there is at least one friction step when we have no richer record facts.
  if (!q.length && selfPerson && selfPerson.state) {
    const st = String(selfPerson.state).toUpperCase();
    q.push({ id: 'state', prompt: 'Which state is on your record?', options: opts(st, pickDecoys(STATE_POOL, [st], 3)) });
  }
  return q.slice(0, max);
}

/** True when every question was answered with its correct option. answers = { [questionId]: chosenLabel }. */
export function gradeKba(questions, answers) {
  if (!questions || !questions.length) return true;
  return questions.every((qq) => {
    const chosen = (answers || {})[qq.id];
    const opt = qq.options.find((o) => o.label === chosen);
    return !!(opt && opt.correct);
  });
}
