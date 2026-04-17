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

export function formatWeeklyAssignmentLabel(
  assignment: Assignment,
  subjectName?: string | null
): string {
  if (assignment.category === 'weekly' && assignment.week_number && subjectName) {
    return `Week ${assignment.week_number} - ${subjectName}`;
  }

  return assignment.title;
}
