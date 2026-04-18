export const GRADE_THRESHOLDS = [
  { letter: 'S', min: 90, color: 'hsl(265 80% 60%)' },
  { letter: 'A', min: 80, color: 'hsl(142 65% 50%)' },
  { letter: 'B', min: 70, color: 'hsl(200 80% 55%)' },
  { letter: 'C', min: 60, color: 'hsl(40 90% 55%)' },
  { letter: 'D', min: 50, color: 'hsl(28 90% 55%)' },
  { letter: 'E', min: 40, color: 'hsl(20 75% 55%)' },
  { letter: 'U', min: 0, color: 'hsl(0 70% 58%)' }
] as const;

export type GradeLetter = typeof GRADE_THRESHOLDS[number]['letter'];

export function getGradeLetter(score: number): GradeLetter {
  for (const g of GRADE_THRESHOLDS) if (score >= g.min) return g.letter;
  return 'U';
}

export function getGradePoint(letter: GradeLetter | 'I' | 'W' | string): number {
  switch (letter) {
    case 'S':
      return 10;
    case 'A':
      return 9;
    case 'B':
      return 8;
    case 'C':
      return 7;
    case 'D':
      return 6;
    case 'E':
      return 4;
    case 'I':
    case 'W':
    case 'U':
    default:
      return 0;
  }
}

export function getGradeColor(score: number): string {
  for (const g of GRADE_THRESHOLDS) if (score >= g.min) return g.color;
  return GRADE_THRESHOLDS[GRADE_THRESHOLDS.length - 1].color;
}

export function isPassing(score: number): boolean {
  return score >= 40;
}
