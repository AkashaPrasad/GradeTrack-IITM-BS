export type CourseLevel = 'foundation' | 'diploma';
export type NotificationKind = 'announcement' | 'reminder' | 'alert';
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
  // Scaler features
  is_scaler_verified: boolean | null;
  scaler_email: string | null;
  scaler_verified_at: string | null;
  whatsapp_number: string | null;
  hostel: 'Uniworld 1' | 'Uniworld 2' | null;
  scaler_id: string | null;
}

export type ExamType = 'quiz1' | 'quiz2' | 'endterm';

export interface ExamSchedule {
  id: string;
  exam_type: ExamType;
  exam_date: string;
  academic_year: string;
  centre_reg_open: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface HallTicket {
  id: string;
  user_id: string;
  exam_type: ExamType;
  student_name: string;
  scaler_id: string;
  centre_name: string;
  centre_address: string | null;
  exam_date: string | null;
  reporting_time: string | null;
  exam_timing: string | null;
  shift: string | null;
  whatsapp_number: string | null;
  hostel: 'Uniworld 1' | 'Uniworld 2' | null;
  pdf_storage_path: string | null;
  uploaded_via: 'pdf' | 'manual';
  uploaded_at: string;
  expires_at: string;
  is_active: boolean;
  is_suggested: boolean;
  suggested_status: 'pending' | 'approved' | 'rejected';
}

export interface HallTicketWithProfile extends HallTicket {
  profile?: Pick<Profile, 'full_name' | 'avatar_url'> | null;
}

export interface BusFormConfig {
  id: string;
  exam_type: ExamType;
  is_open: boolean;
  open_at: string | null;
  close_at: string | null;
  eligible_centres: string[];
  max_seats: number;
  current_seats_taken: number;
  bus_departure_time: string | null;
  bus_pickup_location: string | null;
  close_on_capacity: boolean;
  updated_at: string;
  updated_by: string | null;
}

export interface ExamCentre {
  id: string;
  name: string;
  address: string;
  city: string;
  pincode?: string | null;
  maps_url?: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
}

export interface BusRegistration {
  id: string;
  user_id: string;
  exam_type: ExamType;
  student_name: string;
  scaler_id: string;
  centre_name: string;
  whatsapp_number: string | null;
  hostel: string | null;
  seat_confirmed: boolean;
  confirmed_by: string | null;
  confirmed_at: string | null;
  submitted_at: string;
}

export interface BusRegistrationWithProfile extends BusRegistration {
  profile?: Pick<Profile, 'full_name' | 'email' | 'avatar_url'> | null;
}

export type TermType = 'jan' | 'may' | 'sep';

export interface Term {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  term_type: TermType | null;
  created_by: string | null;
  created_at: string;
}

export interface StudentTerm {
  id: string;
  user_id: string;
  term_id: string | null;
  term_type: TermType;
  level: CourseLevel;
  custom_name: string;
  is_current: boolean;
  subject_ids: string[];
  created_at: string;
  term?: Term;
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

export interface AppNotification {
  id: string;
  title: string;
  body: string | null;
  kind: NotificationKind;
  target_level: CourseLevel | null;
  created_by: string | null;
  created_at: string;
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
