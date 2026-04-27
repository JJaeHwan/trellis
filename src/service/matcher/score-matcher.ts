import type {
  Answer,
  MatchMode,
  MatchResult,
  Playbook,
} from "../../domain/index.js";

const HYBRID_PARITY_GAP = 0.1;

interface ScoredPlaybook {
  playbook: Playbook;
  score: number;
}

export function matchPlaybooks(
  answers: readonly Answer[],
  playbooks: readonly Playbook[],
): MatchResult {
  if (playbooks.length === 0) {
    throw new Error("matchPlaybooks: at least one playbook is required");
  }

  const scored: ScoredPlaybook[] = playbooks
    .map((playbook) => ({ playbook, score: computeScore(answers, playbook) }))
    .sort((a, b) => b.score - a.score);

  const best = scored[0]!;
  const second = scored[1];

  const result: MatchResult = {
    mode: determineMode(best, second),
    primary: best.playbook,
    score: best.score,
    diff: computeDiff(answers, best.playbook),
  };
  return second ? { ...result, secondary: second.playbook } : result;
}

function computeScore(
  answers: readonly Answer[],
  playbook: Playbook,
): number {
  if (answers.length === 0) return 0;
  const total = answers.reduce((sum, answer) => {
    const rule = playbook.scoring.rules.find(
      (r) => r.questionId === answer.questionId,
    );
    if (!rule) return sum;
    return sum + (rule.scores[answer.selectedOptionId] ?? 0);
  }, 0);
  return total / answers.length;
}

function determineMode(
  best: ScoredPlaybook,
  second?: ScoredPlaybook,
): MatchMode {
  const { exactThreshold, closeThreshold } = best.playbook.scoring;
  const closeToSecond =
    second !== undefined &&
    Math.abs(best.score - second.score) < HYBRID_PARITY_GAP;

  if (best.score >= exactThreshold && !closeToSecond) {
    return "exact";
  }
  if (best.score >= closeThreshold && closeToSecond) {
    return "hybrid";
  }
  if (best.score >= closeThreshold) {
    return "close";
  }
  return "new";
}

function computeDiff(
  answers: readonly Answer[],
  playbook: Playbook,
): readonly string[] {
  return answers
    .filter((a) => {
      const rec = playbook.recommendations[a.questionId];
      return rec !== undefined && rec !== a.selectedOptionId;
    })
    .map((a) => {
      const recommended = playbook.recommendations[a.questionId];
      return `Q${a.questionId}: 추천 ${recommended}, 선택 ${a.selectedOptionId}`;
    });
}
