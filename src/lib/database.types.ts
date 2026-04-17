export type CourseLevel = 'foundation' | 'diploma';
export type UserRole = 'student' | 'admin';
export type AssignmentCategory =
  | 'weekly' | 'quiz' | 'endterm' | 'oppe' | 'project' | 'bonus' | 'roe' | 'bpt' | 'ka' | 'extra';
export type TicketKind = 'bug' | 'suggestion' | 'question';
export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  roll_number: string | null;
  level: CourseLevel | null;
  role: UserRole;
  push_subscription: PushSubscriptionJSON | null;
  theme_preference: 'light' | 'dark' | 'system' | null;
  notify_assignments: boolean;
  notify_exams: boolean;
  onboarded: boolean;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Term {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
}

export interface GradingConfig {
  formula: string;
  variables: string[];
  bonusFormula?: string | null;
  bonusCap?: number;
  capTotalAt?: number;
  gaaSource?: string;
  scoring?: Record<string, unknown>;
  eligibility?: Record<string, any>;
  hasOppe?: boolean;
  oppeCount?: number;
  notes?: string;
}

export interface Subject {
  id: string;
  term_id: string;
  level: CourseLevel;
  code: string;
  name: string;
  credits: number;
  has_bonus: boolean;
  bonus_max: number;
  grading_config: GradingConfig;
  created_at: string;
  updated_at: string;
}

export interface Enrolment {
  id: string;
  user_id: string;
  subject_id: string;
  created_at: string;
}

export interface Grade {
  id: string;
  user_id: string;
  subject_id: string;
  qz1_score: number | null;
  qz2_score: number | null;
  final_exam_score: number | null;
  oppe1_score: number | null;
  oppe2_score: number | null;
  roe_score: number | null;
  p1_score: number | null;
  p2_score: number | null;
  ka_score: number | null;
  nppe1_score: number | null;
  nppe2_score: number | null;
  bpta_score: number | null;
  bonus_score: number | null;
  quiz1_attended: boolean;
  quiz2_attended: boolean;
  sct_completed: boolean;
  weekly_scores: (number | null)[];
  extras: Record<string, any>;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Assignment {
  id: string;
  term_id: string;
  subject_id: string | null;
  level: CourseLevel | null;
  title: string;
  description: string | null;
  week_number: number | null;
  category: AssignmentCategory;
  foundation_deadline: string | null;
  degree_diploma_deadline: string | null;
  release_date: string | null;
  exam_date: string | null;
  comments: string | null;
  is_published: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssignmentCompletion {
  id: string;
  user_id: string;
  assignment_id: string;
  is_completed: boolean;
  completed_at: string | null;
  score: number | null;
  skipped: boolean;
  created_at: string;
  updated_at: string;
}

export interface AppLog {
  id: string;
  user_id: string | null;
  event_type: string;
  payload: Record<string, any> | null;
  user_agent: string | null;
  path: string | null;
  severity: 'info' | 'warn' | 'error';
  created_at: string;
}

export interface AppLogWithUser extends AppLog {
  profile?: Pick<Profile, 'full_name' | 'email'> | null;
}

export interface TicketWithProfile extends Ticket {
  profile?: Pick<Profile, 'full_name' | 'email'> | null;
}

export interface Ticket {
  id: string;
  user_id: string | null;
  kind: TicketKind;
  title: string;
  body: string | null;
  status: TicketStatus;
  admin_reply: string | null;
  created_at: string;
  updated_at: string;
}
