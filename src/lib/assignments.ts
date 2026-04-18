import type { Assignment } from './database.types';

export function isWeeklyAssignmentForEnrolledSubject(
  assignment: Assignment,
  enrolledSubjectIds: ReadonlySet<string>
): boolean {
  return (
    assignment.category === 'weekly' &&
    assignment.subject_id !== null &&
    enrolledSubjectIds.has(assignment.subject_id)
  );
}

export function filterWeeklyAssignmentsForEnrolledSubjects(
  assignments: Assignment[],
  enrolledSubjectIds: ReadonlySet<string>
): Assignment[] {
  return assignments.filter((assignment) =>
    isWeeklyAssignmentForEnrolledSubject(assignment, enrolledSubjectIds)
  );
}

export function isAssignmentVisibleForEnrolledSubjects(
  assignment: Assignment,
  enrolledSubjectIds: ReadonlySet<string>
): boolean {
  return assignment.subject_id === null || enrolledSubjectIds.has(assignment.subject_id);
}

export function filterAssignmentsForEnrolledSubjects(
  assignments: Assignment[],
  enrolledSubjectIds: ReadonlySet<string>
): Assignment[] {
  return assignments.filter((assignment) =>
    isAssignmentVisibleForEnrolledSubjects(assignment, enrolledSubjectIds)
  );
}

export function formatWeeklyAssignmentLabel(
  assignment: Assignment,
  subjectName?: string | null
): string {
  if (assignment.category === 'weekly' && assignment.week_number && subjectName) {
    return `Week ${assignment.week_number} - ${subjectName}`;
  }

  return assignment.title;
}

export function normalizeOppeTitle(title: string): string {
  const match = title.match(/^(OPPE\s+\d+)\s+—\s+Day\s+([1-9]\d*)$/i);
  if (!match) return title;

  const base = match[1];
  const day = match[2];

  if (day === '1' || day === '2') {
    return `${base} — Day 1/2`;
  }

  return `${base} — Day ${day}`;
}
