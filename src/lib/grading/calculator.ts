import type { Grade, Subject } from '../database.types';
import { compileFormula } from './formula';
import { getGradeLetter } from './letters';

// ---------- helpers ---------------------------------------------------------

export function bestNOfM(scores: (number | null | undefined)[], n: number, m: number): number {
  const first = scores.slice(0, m).map(s => (typeof s === 'number' ? s : 0));
  const sorted = [...first].sort((a, b) => b - a);
  const take = sorted.slice(0, Math.min(n, sorted.length));
  if (take.length === 0) return 0;
  return take.reduce((a, b) => a + b, 0) / take.length;
}

export function averageOf(scores: (number | null | undefined)[]): number {
  const vals = scores.filter((s): s is number => typeof s === 'number');
  if (vals.length === 0) return 0;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

export function averageOfFirstN(scores: (number | null | undefined)[], n: number): number {
  return averageOf(scores.slice(0, n));
}

// ---------- GAA source resolution ------------------------------------------

function resolveGAA(subject: Subject, grade: Grade): number {
  const src = subject.grading_config.gaaSource ?? 'weeklyAvgFirst10';
  const w = grade.weekly_scores ?? [];
  switch (src) {
    case 'weeklyAvgFirst10':
      return averageOfFirstN(w, 10);
    case 'weeklyAvgFirst9':
      return averageOfFirstN(w, 9);
    case 'weeklyBest5of8':
      return bestNOfM(w, 5, 8);
    case 'best6of7Programming':
      return bestNOfM(w, 6, 7);
    case 'best9of10':
      return bestNOfM(w, 9, 10);
    case 'weeks1and2Programming':
      return averageOfFirstN(w, 2);
    case 'customGLA': {
      // AD1: 70% of best 2 of first 5 (W2..W6 → stored as weekly_scores[1..5]) + 30% of W7 (index 6)
      const best2of5 = bestNOfM(w.slice(1, 6), 2, 5);
      const w7 = typeof w[6] === 'number' ? (w[6] as number) : 0;
      return 0.7 * best2of5 + 0.3 * w7;
    }
    case 'custom':
      // DBMS: GAA2 and GAA3 come from extras directly — not used as GAA.
      return 0;
    default:
      return averageOfFirstN(w, 10);
  }
}

// ---------- build variable map --------------------------------------------

function buildVars(subject: Subject, grade: Grade): Record<string, number> {
  const cfg = subject.grading_config;
  const g = grade;

  const Qz1 = g.qz1_score ?? 0;
  const Qz2 = g.qz2_score ?? 0;
  const F = g.final_exam_score ?? 0;
  const PE1 = g.oppe1_score ?? 0;
  const PE2 = g.oppe2_score ?? 0;
  const OPPE1 = PE1, OPPE2 = PE2;
  const OPPE = Math.max(PE1, PE2);
  const OP = OPPE;
  const ROE = g.roe_score ?? 0;
  const P1 = g.p1_score ?? 0;
  const P2 = g.p2_score ?? 0;
  const KA = g.ka_score ?? 0;
  const NPPE1 = g.nppe1_score ?? 0;
  const NPPE2 = g.nppe2_score ?? 0;
  const BPTA = g.bpta_score ?? 0;
  const B = g.bonus_score ?? 0;
  const GAA = resolveGAA(subject, g);

  // DBMS extras
  const GAA2 = Number(g.extras?.GAA2 ?? 0);
  const GAA3 = Number(g.extras?.GAA3 ?? 0);
  const GLA = resolveGAA(subject, g);

  // BDM: GA = best 3 of 4 assignments (each 0..10). Stored in extras.BDM_GA[].
  const bdmGa: number[] = Array.isArray(g.extras?.BDM_GA) ? g.extras.BDM_GA : [];
  const GA = bdmGa.length > 0
    ? bestNOfM(bdmGa, 3, 4) * 3  // average of best 3 of 4 (each /10), times 3 = sum (10 marks total → see notes in doc)
    : 0;
  // Doc states: "GA = Average of the best 3 out of the 4 assignments (10marks total)".
  // Interpretation: final GA contributes up to 10 marks. Using avg directly gives 0..10.
  const GA_correct = bdmGa.length > 0 ? bestNOfM(bdmGa, 3, 4) : 0;

  // BA: A = sum of best 2 of 3 (each /10). Stored in extras.BA_A[].
  const baA: number[] = Array.isArray(g.extras?.BA_A) ? g.extras.BA_A : [];
  const A = baA.length > 0
    ? [...baA].sort((a, b) => b - a).slice(0, 2).reduce((a, b) => a + b, 0)
    : 0;

  return {
    Qz1, Qz2, F, PE1, PE2, OPPE1, OPPE2, OPPE, OP, ROE, P1, P2, KA,
    NPPE1, NPPE2, BPTA, B, GAA, GAA2, GAA3, GLA,
    GA: GA_correct, // use the correct interpretation (avg 0..10)
    A
  };
  // Note: if admin changes formula to reference an unknown var, the evaluator
  // will throw, caught by the caller and rendered as a friendly error.
}

// ---------- scoring --------------------------------------------------------

export interface ScoreResult {
  total: number;
  letter: string;
  bonusApplied: number;
  capped: boolean;
  error?: string;
}

export function calculateScore(subject: Subject, grade: Grade): ScoreResult {
  try {
    const cfg = subject.grading_config;
    const vars = buildVars(subject, grade);
    const base = compileFormula(cfg.formula).evaluate(vars);
    let bonus = 0;
    if (cfg.bonusFormula) {
      const rawBonus = compileFormula(cfg.bonusFormula).evaluate(vars);
      const cap = cfg.bonusCap ?? 0;
      bonus = Math.min(rawBonus, cap);
    }
    const pre = base + bonus;
    const cap = cfg.capTotalAt ?? 100;
    const capped = pre > cap;
    const total = Math.max(0, Math.min(pre, cap));
    return {
      total: Math.round(total * 100) / 100,
      letter: getGradeLetter(total),
      bonusApplied: Math.round(bonus * 100) / 100,
      capped
    };
  } catch (e: any) {
    return { total: 0, letter: 'U', bonusApplied: 0, capped: false, error: e?.message ?? 'Formula error' };
  }
}

// ---------- eligibility ----------------------------------------------------

export interface EligibilityResult {
  endterm: { eligible: boolean; reason?: string; details: string[] };
  finalGrade: { eligible: boolean; reason?: string; details: string[] };
  oppe1?: { eligible: boolean; reason?: string; details: string[] };
  oppe2?: { eligible: boolean; reason?: string; details: string[] };
  oppe?: { eligible: boolean; reason?: string; details: string[] };
}

function checkOppeEligibility(
  weekly: (number | null | undefined)[],
  rules: any,
  sct: boolean
): { eligible: boolean; reason?: string; details: string[] } {
  const details: string[] = [];
  if (rules.requireSCT && !sct) {
    return { eligible: false, reason: 'SCT not completed', details: ['SCT exam required.'] };
  }
  if (rules.requireSCT) details.push('✓ SCT completed');
  if (Array.isArray(rules.weeks)) {
    const thr = rules.weeklyGrpaThreshold ?? 40;
    for (const wk of rules.weeks as number[]) {
      const s = weekly[wk - 1];
      const v = typeof s === 'number' ? s : 0;
      if (v < thr) {
        return { eligible: false, reason: `Week ${wk} < ${thr}`, details: [...details, `✗ Week ${wk}: ${v}/100 (need ≥${thr})`] };
      }
      details.push(`✓ Week ${wk}: ${v}/100`);
    }
  }
  if (rules.bestNof7Threshold) {
    const avg = bestNOfM(weekly, 5, 7);
    if (avg < rules.bestNof7Threshold) {
      return { eligible: false, reason: `Best 5 of 7 < ${rules.bestNof7Threshold}`, details: [...details, `✗ Best 5/7 avg: ${avg.toFixed(1)} (need ≥${rules.bestNof7Threshold})`] };
    }
    details.push(`✓ Best 5/7 avg: ${avg.toFixed(1)}`);
  }
  if (rules.bptAvgFirst3) {
    // handled by caller (SC course uses BPTA)
  }
  return { eligible: true, details };
}

export function checkEligibility(subject: Subject, grade: Grade): EligibilityResult {
  const cfg = subject.grading_config;
  const weekly = grade.weekly_scores ?? [];
  const sct = grade.sct_completed;
  const e = cfg.eligibility ?? {};

  const result: EligibilityResult = {
    endterm: { eligible: true, details: [] },
    finalGrade: { eligible: true, details: [] }
  };

  // End-term eligibility -----------------------------------------------
  const et = e.endterm ?? {};
  const etDetails: string[] = [];
  let etOk = true;
  let etReason: string | undefined;

  if (et.bestNof7Threshold) {
    const avg = bestNOfM(weekly, 5, 7);
    if (avg < et.bestNof7Threshold) {
      etOk = false;
      etReason = `Best 5/7 weekly avg is ${avg.toFixed(1)}, need ≥${et.bestNof7Threshold}`;
      etDetails.push(`✗ Best 5/7 avg: ${avg.toFixed(1)}/100`);
    } else {
      etDetails.push(`✓ Best 5/7 avg: ${avg.toFixed(1)}/100`);
    }
  }
  if (et.requireQuizAttendance) {
    if (!grade.quiz1_attended && !grade.quiz2_attended) {
      etOk = false;
      etReason = etReason ?? 'Must attend at least one quiz';
      etDetails.push('✗ No quiz attended');
    } else {
      etDetails.push('✓ Quiz attendance recorded');
    }
  }
  if (et.firstNWeeksAvgThreshold) {
    const { n, threshold } = et.firstNWeeksAvgThreshold;
    const avg = averageOfFirstN(weekly, n);
    if (avg < threshold) {
      etOk = false;
      etReason = etReason ?? `First ${n} weeks avg is ${avg.toFixed(1)}, need ≥${threshold}`;
      etDetails.push(`✗ First ${n} weeks avg: ${avg.toFixed(1)}/100`);
    } else {
      etDetails.push(`✓ First ${n} weeks avg: ${avg.toFixed(1)}/100`);
    }
  }
  if (et.best4of5GAThreshold) {
    const avg = bestNOfM(weekly, 4, 5);
    if (avg < et.best4of5GAThreshold) {
      etOk = false;
      etReason = etReason ?? `Best 4/5 GAs avg ${avg.toFixed(1)}, need ≥${et.best4of5GAThreshold}`;
      etDetails.push(`✗ Best 4/5 GAs: ${avg.toFixed(1)}`);
    } else {
      etDetails.push(`✓ Best 4/5 GAs: ${avg.toFixed(1)}`);
    }
  }
  if (et.customBDM) {
    const bdmGa: number[] = Array.isArray(grade.extras?.BDM_GA) ? grade.extras.BDM_GA : [];
    const submitted = bdmGa.slice(0, 3).filter(x => typeof x === 'number' && x > 0).length;
    const first3 = bdmGa.slice(0, 3).map(x => (typeof x === 'number' ? x : 0) * 10); // convert /10 → /100
    const bestOfFirst3 = [...first3].sort((a, b) => b - a).slice(0, 2);
    const avg = bestOfFirst3.length ? bestOfFirst3.reduce((a, b) => a + b, 0) / bestOfFirst3.length : 0;
    if (submitted < (et.minGAsSubmitted ?? 1)) {
      etOk = false; etReason = `Submit at least ${et.minGAsSubmitted ?? 1} GA`;
      etDetails.push(`✗ GAs submitted: ${submitted}`);
    } else {
      etDetails.push(`✓ GAs submitted: ${submitted}`);
    }
    if (avg < et.bestOfFirst3GA) {
      etOk = false; etReason = etReason ?? `Best 2/3 first GAs avg ${avg.toFixed(1)} (need ≥${et.bestOfFirst3GA})`;
      etDetails.push(`✗ Best 2/3 first GAs: ${avg.toFixed(1)}/100`);
    } else {
      etDetails.push(`✓ Best 2/3 first GAs: ${avg.toFixed(1)}/100`);
    }
  }
  if (et.customBA) {
    const baA: number[] = Array.isArray(grade.extras?.BA_A) ? grade.extras.BA_A : [];
    const submitted = baA.filter(x => typeof x === 'number' && x > 0).length;
    if (submitted < (et.minAssignmentsSubmitted ?? 1)) {
      etOk = false; etReason = `Submit at least ${et.minAssignmentsSubmitted ?? 1} assignment`;
      etDetails.push(`✗ Assignments submitted: ${submitted}`);
    } else {
      etDetails.push(`✓ Assignments submitted: ${submitted}`);
    }
    if (et.requireQuizAttendance && !grade.quiz1_attended && !grade.quiz2_attended) {
      etOk = false; etReason = etReason ?? 'Attend a quiz';
    }
  }
  if (et.requireOppeEligible) {
    // For Python: need to be eligible for at least one OPPE.
    const o1 = cfg.eligibility?.oppe1 ? checkOppeEligibility(weekly, cfg.eligibility.oppe1, sct) : null;
    const o2 = cfg.eligibility?.oppe2 ? checkOppeEligibility(weekly, cfg.eligibility.oppe2, sct) : null;
    if (o1 && !o1.eligible && o2 && !o2.eligible) {
      etOk = false; etReason = etReason ?? 'Not eligible for any OPPE';
      etDetails.push('✗ Ineligible for both OPPE1 and OPPE2');
    } else {
      etDetails.push('✓ Eligible for at least one OPPE');
    }
  }

  result.endterm = { eligible: etOk, reason: etReason, details: etDetails };

  // OPPE-specific eligibility ------------------------------------------
  if (e.oppe1) result.oppe1 = checkOppeEligibility(weekly, e.oppe1, sct);
  if (e.oppe2) result.oppe2 = checkOppeEligibility(weekly, { ...e.oppe2, bestNof7Threshold: e.oppe2.bestNof7Threshold }, sct);
  if (e.oppe) {
    if (e.oppe.bptAvgFirst3) {
      const b = grade.bpta_score ?? 0;
      const ok = b >= e.oppe.bptAvgFirst3;
      result.oppe = { eligible: ok, details: [ok ? `✓ BPT avg ≥ ${e.oppe.bptAvgFirst3}` : `✗ BPT avg: ${b.toFixed(1)}`] };
    } else {
      result.oppe = checkOppeEligibility(weekly, e.oppe, sct);
    }
  }

  // Final grade eligibility --------------------------------------------
  const fg = e.finalGrade ?? {};
  const fgDetails: string[] = [];
  let fgOk = true;
  let fgReason: string | undefined;

  if (fg.requireEndterm) {
    if (!etOk) {
      fgOk = false; fgReason = 'Not eligible to write end term';
    }
  }
  if (fg.minOppeBest !== undefined && fg.minOppeBest !== null) {
    const best = Math.max(grade.oppe1_score ?? 0, grade.oppe2_score ?? 0);
    if (best < fg.minOppeBest) {
      fgOk = false; fgReason = fgReason ?? `One OPPE must score ≥ ${fg.minOppeBest}`;
      fgDetails.push(`✗ Max OPPE: ${best}/100`);
    } else {
      fgDetails.push(`✓ Max OPPE: ${best}/100`);
    }
  }
  if (fg.minOppe !== undefined && fg.minOppe !== null) {
    const op = grade.oppe1_score ?? 0;
    if (op < fg.minOppe) {
      fgOk = false; fgReason = fgReason ?? `OPPE must score ≥ ${fg.minOppe}`;
      fgDetails.push(`✗ OPPE: ${op}/100`);
    } else {
      fgDetails.push(`✓ OPPE: ${op}/100`);
    }
  }
  if (fg.minFinalExam !== undefined && fg.minFinalExam !== null) {
    const F = grade.final_exam_score ?? 0;
    if (F < fg.minFinalExam) {
      fgOk = false; fgReason = fgReason ?? `Final exam must be ≥ ${fg.minFinalExam}`;
      fgDetails.push(`✗ Final exam: ${F}`);
    } else {
      fgDetails.push(`✓ Final exam: ${F}`);
    }
  }
  if (fg.minTotal !== undefined) {
    const { total } = calculateScore(subject, grade);
    if (total < fg.minTotal) {
      fgOk = false; fgReason = fgReason ?? `Total must be ≥ ${fg.minTotal}`;
      fgDetails.push(`✗ Total: ${total.toFixed(1)}`);
    }
  }

  result.finalGrade = { eligible: fgOk, reason: fgReason, details: fgDetails };
  return result;
}

// ---------- "what score do I need" targeting -------------------------------

export interface TargetResult {
  letter: string;
  minScore: number;
  achievable: boolean;
  minFinalExamNeeded: number | null;
}

/**
 * Solve (numerically) for F (final exam score) such that calculateScore() ≥ target.
 * Most formulas are piecewise-linear in F so we do a small 0..100 scan at 0.5 resolution.
 */
export function minFinalForTargets(
  subject: Subject,
  grade: Grade,
  targets = [70, 80, 90]
): TargetResult[] {
  const baseGrade = { ...grade };
  const results: TargetResult[] = [];
  for (const target of targets) {
    let needed: number | null = null;
    for (let f = 0; f <= 100; f += 0.5) {
      const g: Grade = { ...baseGrade, final_exam_score: f };
      const { total } = calculateScore(subject, g);
      if (total >= target) { needed = f; break; }
    }
    let letter = 'B';
    if (target >= 90) letter = 'S';
    else if (target >= 80) letter = 'A';
    else if (target >= 70) letter = 'B';
    else if (target >= 60) letter = 'C';
    else letter = 'E';
    results.push({
      letter,
      minScore: target,
      achievable: needed !== null,
      minFinalExamNeeded: needed
    });
  }
  return results;
}

export function bestWeeklyAverage(weekly: (number | null | undefined)[]): number {
  return bestNOfM(weekly, 5, 7);
}
