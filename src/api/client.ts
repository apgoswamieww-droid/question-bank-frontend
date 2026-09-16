const TOKEN_KEY = "qb.admin.token";
const USER_KEY = "qb.admin.user";
const PERMS_KEY = "qb.admin.permissions";

// Base URL for the Question Bank API. In dev this is empty so requests go to
// the Vite proxy (/api -> localhost:4000). In production it points to the
// deployed backend (e.g. https://<backend>.onrender.com).
const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

export type UserRole = "super_admin" | "teacher" | "student" | (string & {});

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  active: boolean;
  profileImage: string | null;
  phone: string | null;
  gender: string | null;
  dateOfBirth: string | null;
  address: string | null;
  hireDate: string | null;
  subject: string | null;
  qualification: string | null;
}

export interface Permission {
  code: string;
  label: string;
  description: string;
  module?: string;
}

export interface Role {
  code: string;
  name: string;
  description: string | null;
}

export type PermissionMatrix = Record<string, string[]>;

const storage = {
  get token(): string | null {
    return localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY);
  },
  get user(): string | null {
    return localStorage.getItem(USER_KEY) ?? sessionStorage.getItem(USER_KEY);
  },
  get permissions(): string | null {
    return localStorage.getItem(PERMS_KEY) ?? sessionStorage.getItem(PERMS_KEY);
  },
};

export class ApiError extends Error {
  code: string;
  status: number;
  retryAfter?: number;
  /** Full parsed response body (when JSON) — e.g. shortage reports. */
  body?: unknown;

  constructor(message: string, code: string, status: number, retryAfter?: number, body?: unknown) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.retryAfter = retryAfter;
    this.body = body;
  }
}

export function getStoredToken(): string | null {
  return storage.token;
}

export function getStoredUser(): AdminUser | null {
  try {
    const raw = storage.user;
    return raw ? (JSON.parse(raw) as AdminUser) : null;
  } catch {
    return null;
  }
}

export function getStoredPermissions(): string[] {
  try {
    const raw = storage.permissions;
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function storeSession(
  token: string,
  user: AdminUser,
  remember = true,
  permissions: string[] = []
): void {
  clearSession();
  const store = remember ? localStorage : sessionStorage;
  store.setItem(TOKEN_KEY, token);
  store.setItem(USER_KEY, JSON.stringify(user));
  store.setItem(PERMS_KEY, JSON.stringify(permissions));
}

export function storePermissions(permissions: string[]): void {
  const store = localStorage.getItem(PERMS_KEY) !== null ? localStorage : sessionStorage;
  store.setItem(PERMS_KEY, JSON.stringify(permissions));
}

export function clearSession(): void {
  [localStorage, sessionStorage].forEach((s) => {
    s.removeItem(TOKEN_KEY);
    s.removeItem(USER_KEY);
    s.removeItem(PERMS_KEY);
  });
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  auth?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, auth = true } = options;

  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = getStoredToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}/api${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: "omit",
  });

  if (response.status === 401 && auth) {
    clearSession();
  }    if (!response.ok) {
      let message = `Request failed (${response.status})`;
      let code = "UNKNOWN";
      let retryAfter: number | undefined;
      let parsedBody: unknown;
      try {
        const data = (await response.json()) as {
          error?: string;
          code?: string;
          retryAfter?: number;
        };
        parsedBody = data;
        if (data.error) message = data.error;
        if (data.code) code = data.code;
        if (data.retryAfter) retryAfter = data.retryAfter;
      } catch {
        /* non-JSON error body — keep default message */
      }
      throw new ApiError(message, code, response.status, retryAfter, parsedBody);
    }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

/** Fetch that resolves to a Blob (binary downloads such as exported PDFs). */
async function requestBlob(path: string, options: RequestOptions = {}): Promise<Blob> {
  const { method = "GET", body, auth = true } = options;
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = getStoredToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  const response = await fetch(`${API_BASE_URL}/api${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: "omit",
  });
  if (response.status === 401 && auth) {
    clearSession();
  }
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    let code = "UNKNOWN";
    try {
      const data = (await response.json()) as { error?: string; code?: string };
      if (data.error) message = data.error;
      if (data.code) code = data.code;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(message, code, response.status);
  }
  return response.blob();
}

/** Query-string builder shared by the answer-key / solutions report calls. */
function reportRequest(tail: string, id: string, options: PaperReportOptions = {}): Promise<PaperReport> {
  const qs: string[] = [];
  if (options.set) qs.push(`set=${encodeURIComponent(options.set)}`);
  if (options.language) qs.push(`language=${encodeURIComponent(options.language)}`);
  return request(`/admin/papers/${id}${tail}${qs.length ? `?${qs.join("&")}` : ""}`);
}

export interface LoginResponse {
  token: string;
  user: AdminUser;
  role: UserRole;
  permissions: string[];
}

export interface UserRegistrationFields {
  phone?: string;
  gender?: string;
  dateOfBirth?: string;
  address?: string;
  hireDate?: string;
  subject?: string;
  qualification?: string;
}

export interface ProfileFields {
  profileImage?: string;
}

export interface UserCrudInput extends UserRegistrationFields, ProfileFields {
  email: string;
  name: string;
  password: string;
  role: UserRole;
  active?: boolean;
}

export type UserUpdateInput = Partial<{
  name: string;
  email: string;
  password: string;
  active: boolean;
  profileImage: string;
}> & UserRegistrationFields;

export interface UpdateProfileInput extends UserRegistrationFields, ProfileFields {
  name?: string;
  email?: string;
}

// ---------------------------------------------------------------------------
// Master Data types
// ---------------------------------------------------------------------------
export interface Standard {
  id: string;
  name: string;
  sort_order: number;
  active: boolean;
}

export interface Subject {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  sort_order: number;
  active: boolean;
}

// A row in the standard_subjects junction (subject joined in).
export interface StandardSubjectMapping {
  id: string;
  standard_id: string;
  subject_id: string;
  sort_order: number;
  subject?: Pick<Subject, "id" | "name" | "icon" | "color" | "sort_order" | "active"> | null;
}

export interface Chapter {
  id: string;
  subject_id: string;
  standard_id: string;
  resource_type_ids: string[];
  name: string;
  number: number | null;
  description: string | null;
  sort_order: number;
  active: boolean;
}

export interface ResourceType {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  sort_order: number;
  active: boolean;
}

export interface Topic {
  id: string;
  chapter_id: string;
  name: string;
  number: string | null;
  description: string | null;
  sort_order: number;
  active: boolean;
}

export interface ExamType {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  sort_order: number;
  active: boolean;
}

export interface Language {
  id: string;
  code: string;
  name: string;
  native_name: string | null;
  active: boolean;
}

export interface QuestionLevel {
  id: string;
  code: string;
  name: string;
  color: string | null;
  icon: string | null;
  sort_order: number;
  active: boolean;
}

export interface School {
  id: string;
  name: string;
  code: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
  board: string | null;
  type: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  active: boolean;
}

export interface Question {
  id: string;
  bank_id: string | null;
  created_by: string;
  standard_id: string | null;
  subject_id: string | null;
  chapter_id: string | null;
  topic_id: string | null;
  type: string;
  exam_type_id: string | null;
  language_id: string | null;
  difficulty: string | null;
  level_id: string | null;
  exam_year: number | null;
  content: unknown;
  explanation: unknown | null;
  image_url: string | null;
  marks: number;
  negative_marks: number;
  time_limit_sec: number | null;
  quality_score: number;
  tags: string[];
  status: string;
  sort_order: number;
  family_id: string | null;
  created_at: string;
  updated_at: string;
  usage_count?: number;
}

export interface QuestionOption {
  id: string;
  question_id: string;
  label: string;
  content: unknown;
  is_correct: boolean;
  sort_order: number;
}

export interface QuestionVariant extends Question {
  options: QuestionOption[];
  payload: unknown;
}

export interface QuestionFilters {
  bank_id?: string;
  standard_id?: string;
  subject_id?: string;
  resource_type_id?: string;
  chapter_id?: string;
  topic_id?: string;
  type?: string;
  difficulty?: string;
  level_id?: string;
  exam_type_id?: string;
  language_id?: string;
  exam_year?: number;
  status?: string;
  tags?: string[];
  created_by?: string;
  search?: string;
  q?: string;
  min_marks?: number;
  max_marks?: number;
  min_negative_marks?: number;
  max_negative_marks?: number;
  created_from?: string;
  created_to?: string;
  updated_from?: string;
  updated_to?: string;
  family_id?: string;
  with_usage?: boolean;
  limit?: number;
  offset?: number;
}

export interface QuestionListResponse {
  questions: Question[];
  total: number;
  limit: number;
  offset: number;
  with_usage?: boolean;
}

export interface QuestionAggregateIdCount {
  id: string;
  count: number;
}

export interface QuestionAggregateCounts {
  by_standard: QuestionAggregateIdCount[];
  by_subject: QuestionAggregateIdCount[];
  by_chapter: QuestionAggregateIdCount[];
  by_topic: QuestionAggregateIdCount[];
}

export type QuestionAggregateDim = "standard" | "subject" | "chapter" | "topic";

export interface AnalyticsOverview {
  total: number;
  published: number;
  drafts: number;
  archived: number;
  total_usage: number;
  used_questions: number;
  unused_questions: number;
  avg_success_rate: number;
  most_used: (Question & { usage_count: number }) | null;
}

export interface AnalyticsUsageRow {
  usage_count: number;
}

export interface SchoolUsageRow extends AnalyticsUsageRow {
  school_id: string;
  school_name: string;
  class_names: string[];
}

export interface TeacherUsageRow extends AnalyticsUsageRow {
  teacher_id: string;
  teacher_name: string;
}

export interface OverTimeBucket {
  key: string;
  count: number;
}

export interface OverTimeData {
  daily: OverTimeBucket[];
  weekly: OverTimeBucket[];
  monthly: OverTimeBucket[];
}

export interface PerformanceBucket {
  attempts: number;
  correct: number;
  success_rate: number;
}

export interface DifficultyPerfBucket extends PerformanceBucket {
  difficulty: string;
}

export interface SubjectPerfBucket extends PerformanceBucket {
  subject_id: string;
  subject_name: string;
}

export interface PerformanceData {
  by_difficulty: DifficultyPerfBucket[];
  by_subject: SubjectPerfBucket[];
  overall: { attempts: number; success_rate: number };
}

export type TestStatus = "draft" | "published" | "archived";

export interface Test {
  id: string;
  title: string;
  description: string | null;
  standard_id: string | null;
  subject_id: string | null;
  exam_type_id: string | null;
  language_id: string | null;
  duration_min: number;
  total_marks: number;
  passing_marks: number;
  shuffle_questions: boolean;
  shuffle_options: boolean;
  show_results: boolean;
  show_answers: boolean;
  status: TestStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  question_count?: number;
}

export interface TestQuestion {
  id: string;
  question_id: string;
  sort_order: number;
  marks: number;
  question: Question;
  options: QuestionOption[];
}

export interface TestWithQuestions extends Test {
  questions: TestQuestion[];
}

export interface TestInput {
  title: string;
  description?: string | null;
  standard_id?: string | null;
  subject_id?: string | null;
  exam_type_id?: string | null;
  language_id?: string | null;
  duration_min?: number;
  total_marks?: number;
  passing_marks?: number;
  shuffle_questions?: boolean;
  shuffle_options?: boolean;
  show_results?: boolean;
  show_answers?: boolean;
  status?: TestStatus;
  questionIds?: string[];
}

export type PaperStatus = "draft" | "validated" | "published" | "archived";

export interface Paper {
  id: string;
  title: string;
  description: string | null;
  standard_id: string | null;
  subject_id: string | null;
  exam_type_id: string | null;
  duration_min: number;
  total_marks: number;
  status: PaperStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  /** When the paper was last marked validated (Phase 16; null pre-migration). */
  validated_at?: string | null;
  /** When the paper was last published (Phase 16; null pre-migration). */
  published_at?: string | null;
  /** When the paper was last archived (Phase 16; null pre-migration). */
  archived_at?: string | null;
  question_count?: number;
}

export interface PaperFamilyVariant extends Question {
  options: QuestionOption[];
  payload: unknown;
}

export interface PaperFamily {
  id: string;
  family_id: string;
  sort_order: number;
  marks: number;
  /** Blueprint section assignment (Phase 4; null on pre-section records). */
  section_key?: string | null;
  /** Locked questions survive regeneration (Phase 5; false by default). */
  locked?: boolean;
  primary: PaperFamilyVariant | null;
  variants: PaperFamilyVariant[];
}

// -------------------------------------------------------------------------
// Replace question (Paper Generator Phase 5)
// -------------------------------------------------------------------------
export interface ReplaceDryRun {
  dryRun: true;
  match: string;
  exact: boolean;
  replacement: Question;
}

export interface ReplaceResult {
  match: string;
  exact: boolean;
  replacedWith: Question;
  families: PaperFamily[];
  paper: Paper;
}

// -------------------------------------------------------------------------
// Paper validation (Paper Generator Phase 6)
// -------------------------------------------------------------------------
export type ValidationLevel = "ERROR" | "WARNING" | "INFO";

export interface ValidationIssue {
  /** Section label the issue belongs to ("Paper" for paper-level). */
  section: string | null;
  /** Question label, e.g. "Q3" or "family 6054…" — null for paper-level. */
  question: string | null;
  /** Field the issue is about, e.g. "options.is_correct", "image.src", "marks". */
  field: string | null;
  problem: string;
  action: string;
}

export interface ValidationIssueWithLevel extends ValidationIssue {
  level: ValidationLevel;
}

export interface ValidationReport {
  paperId: string;
  results: ValidationIssueWithLevel[];
  summary: {
    errors: number;
    warnings: number;
    infos: number;
    canPublish: boolean;
    computedMarks: number;
    questionCount: number;
    migrationRequired: boolean;
    migrationNote: string | null;
  };
}

// -------------------------------------------------------------------------
// Paper lifecycle (Paper Generator Phase 16)
// -------------------------------------------------------------------------
export interface PaperValidateResult {
  validated: boolean;
  promoted: boolean;
  status: PaperStatus;
  summary: ValidationReport["summary"];
}

export interface PaperTransitionResult {
  archived?: boolean;
  restored?: boolean;
  status: PaperStatus;
}

// -------------------------------------------------------------------------
// Paper sets & randomization (Paper Generator Phase 7)
// -------------------------------------------------------------------------
export interface SetQuestion {
  /** Master question family reference — Question Bank is never duplicated. */
  familyId: string;
  /** 1-based question number within the set. */
  number: number;
  marks: number;
  sectionKey: string | null;
  /** Display position -> original option index (option-bearing types only). */
  optionPermutation: number[] | null;
}

export interface PaperSet {
  key: string;
  name: string;
  /** Deterministic seed: `${baseSeed}:set${key}:v${version}`. */
  seed: string;
  version: number;
  generatedAt: string;
  questionCount: number;
  totalMarks: number;
  questions: SetQuestion[];
}

export interface PaperSetsDoc {
  schemaVersion: number;
  baseSeed: string;
  version: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  generatedAt: string;
  count: number;
  sets: PaperSet[];
}

export interface GenerateSetsOptions {
  count?: number;
  labels?: string[];
  shuffleQuestions?: boolean;
  shuffleOptions?: boolean;
  baseSeed?: string;
  /** Explicit version reproduces an earlier randomization; omit to re-roll. */
  version?: number;
}

export interface AnswerKeyEntry {
  number: number;
  familyId: string;
  questionId: string | null;
  type: string | null;
  marks: number;
  /** Resolved answer for the set's option order ("C", "A, C", "42", …). */
  answer: string | null;
  displayOptions: { label: string; content: unknown; originalLabel: string }[] | null;
}

export interface SetAnswerKey {
  paperId?: string;
  setKey: string;
  setName: string;
  seed: string;
  version: number;
  generatedAt?: string;
  requested_language_id?: string | null;
  complete?: boolean;
  substituted?: number;
  missing?: number;
  questionCount: number;
  totalMarks: number;
  answers: AnswerKeyEntry[];
  warnings: string[];
}

export interface PaperReportEntry {
  number: number;
  familyId: string;
  questionId: string | null;
  type: string | null;
  marks: number;
  answer: string | null;
  answerMissing: boolean;
  substituted: boolean;
  languageId: string | null;
  permutationApplied: boolean;
  permutationDrift: boolean;
  questionMissing: boolean;
  /** Solutions reports only. */
  explanationPresent?: boolean;
  question?: unknown | null;
  options?: { label: string; content: unknown; originalLabel: string }[] | null;
  explanation?: unknown | null;
  explanationMissing?: boolean;
}

export interface PaperReportSection {
  key: string;
  name: string;
  negativeMarks: number;
  entries: PaperReportEntry[];
}

export interface PaperReportSummary {
  appliedOrder: "master" | "set";
  questionCount: number;
  totalMarks: number;
  answered: number;
  missingAnswer: number;
  missingExplanation: number;
  substituted: number;
  complete: boolean;
  warnings: string[];
}

/** Answer-key / solutions report built from a paper's ACTUAL final structure. */
export interface PaperReport {
  paperId: string | null;
  scope: "master" | "set";
  setKey: string | null;
  requestedLanguage: string | null;
  sections: PaperReportSection[];
  summary: PaperReportSummary;
}

export interface PaperReportOptions {
  set?: string | null;
  language?: string | null;
}

// -------------------------------------------------------------------------
// Paper analysis & quality report (Paper Generator Phase 14)
// -------------------------------------------------------------------------
export interface PaperAnalysisSection {
  key: string;
  name: string;
  negativeMarks: number;
  count: number;
  marks: number;
}

export interface PaperAnalysisBucket {
  key: string;
  label: string;
  count: number;
  marks?: number;
}

export interface PaperLanguageCoverage {
  id: string;
  code: string | null;
  name: string;
  covered: number;
  missing: number;
  coverage: number;
}

export interface FamilyDuplicate {
  familyId: string;
  count: number;
  sections: string[];
}

export interface ContentDuplicate {
  count: number;
  familyIds: string[];
}

export interface BlueprintRuleVariance {
  ruleId: string;
  sectionKey: string | null;
  sectionName: string;
  label: string;
  target: number;
  actual: number;
  delta: number;
}

export interface BlueprintSectionVariance {
  key: string;
  name: string;
  targetCount: number;
  actualCount: number;
  countDelta: number;
  targetMarks: number;
  actualMarks: number;
  marksDelta: number;
}

export interface BlueprintVarianceSummary {
  hasBlueprint: boolean;
  targetQuestions: number;
  actualQuestions: number;
  questionsDelta: number;
  targetMarks: number;
  actualMarks: number;
  marksDelta: number;
}

export interface BlueprintVariance {
  summary: BlueprintVarianceSummary;
  sections: BlueprintSectionVariance[];
  rules: BlueprintRuleVariance[];
  warnings: string[];
}

export interface PaperAnalysis {
  paperId: string | null;
  paper: {
    id: string | null;
    title: string | null;
    description: string | null;
    duration_min: number | null;
    total_marks: number | null;
    status: string | null;
  };
  actual: {
    totalQuestions: number;
    totalMarks: number;
    durationMin: number | null;
    declaredTotalMarks: number | null;
    declaredQuestions: number | null;
  };
  sectionDistribution: PaperAnalysisSection[];
  typeDistribution: PaperAnalysisBucket[];
  difficultyDistribution: PaperAnalysisBucket[];
  chapterDistribution: { id: string | null; name: string; count: number }[];
  topicDistribution: { id: string | null; name: string; count: number }[];
  languageCoverage: PaperLanguageCoverage[];
  duplicates: { familyDuplicates: FamilyDuplicate[]; contentDuplicates: ContentDuplicate[] };
  blueprintVariance: BlueprintVariance | null;
  migrationRequired?: boolean;
}

// -------------------------------------------------------------------------
// Paper versioning & history (Paper Generator Phase 15)
// -------------------------------------------------------------------------
export type PaperVersionReason = "created" | "baseline" | "manual" | "published" | "restore";

export interface PaperVersionTemplateRef {
  id: string | null;
  name: string | null;
}

export interface PaperVersionLanguagePaperRef {
  language_id: string;
  version: number;
  set_key: string | null;
  status: string;
}

export interface PaperVersionFamily {
  family_id: string;
  sort_order: number;
  marks: number;
  section_key: string | null;
  locked: boolean;
  languages: string[];
  question_digest: string | null;
}

export interface PaperVersionSnapshot {
  schemaVersion: number;
  paper: {
    id: string | null;
    title: string | null;
    description: string | null;
    standard_id: string | null;
    subject_id: string | null;
    exam_type_id: string | null;
    duration_min: number | null;
    total_marks: number | null;
    status: string | null;
  };
  template: PaperVersionTemplateRef | null;
  blueprint: Record<string, unknown> | null;
  families: PaperVersionFamily[];
  sets: Record<string, unknown> | null;
  translations: Record<string, unknown> | null;
  languagePapers: PaperVersionLanguagePaperRef[];
  totals: { questionCount: number; totalMarks: number };
}

export interface PaperVersionReplacement {
  from: string;
  to: string;
}

export interface PaperVersionChanges {
  changed: boolean;
  additions: string[];
  removals: string[];
  replacements: PaperVersionReplacement[];
  reorderCount: number;
  reordered: boolean;
  marksChanged: string[];
  sectionsChanged: string[];
  blueprintChanged: boolean;
  setsChanged: boolean;
  translationsChanged: boolean;
  languagePapersChanged: {
    added: PaperVersionLanguagePaperRef[];
    removed: PaperVersionLanguagePaperRef[];
  };
  templateChanged: { from: PaperVersionTemplateRef | null; to: PaperVersionTemplateRef | null } | null;
  fieldChanges: string[];
  questionCount: { from: number; to: number };
  totalMarks: { from: number; to: number };
  languagesChanged: { added: string[]; removed: string[]; affectedFamilies: number };
  summary: string;
}

export interface PaperVersion {
  id: string;
  paper_id: string;
  version: number;
  reason: PaperVersionReason;
  note: string | null;
  summary: string | null;
  changes: PaperVersionChanges;
  parent_version: number | null;
  created_by: string | null;
  created_at: string;
}

export interface PaperVersionDetail extends PaperVersion {
  snapshot: PaperVersionSnapshot;
}

export interface PaperVersionsList {
  paper: { id: string; title: string; status: string; updated_at: string };
  versions: PaperVersion[];
  currentVersion: number;
  createdVersion: number;
  dirty: boolean;
  migrationRequired: boolean;
}

export interface PaperVersionCreateInput {
  reason?: "manual" | "published";
  note?: string;
  template?: PaperVersionTemplateRef | null;
}

export interface PaperVersionCreateResult {
  created: boolean;
  paperId: string;
  version?: number;
  reason?: string;
  summary?: string;
  changes?: PaperVersionChanges;
  createdAt?: string;
  message?: string;
  currentVersion?: number;
}

export interface PaperVersionRestoreResult {
  restored: boolean;
  restoredFrom: number;
  version?: number;
  summary?: string;
  changes?: PaperVersionChanges;
  note?: string;
  skipped: number;
  migrationRequired?: boolean;
}

// -------------------------------------------------------------------------
// Multilingual Paper Engine (Paper Generator Phase 8)
// -------------------------------------------------------------------------
export type TranslationState = "missing" | "draft" | "translated" | "reviewed" | "approved";

export interface InvariantIssue {
  field: string;
  problem: string;
  action: string;
}

export interface LanguageQuestionStatus {
  number: number;
  familyId: string;
  questionId: string | null;
  state: TranslationState;
  invariantIssues: InvariantIssue[];
}

export interface LanguageReadiness {
  language: { id: string; code: string | null; name: string };
  paperState: TranslationState;
  note: string | null;
  sectionInstructions: Record<string, string>;
  counts: Record<TranslationState, number>;
  coverage: number;
  ready: boolean;
  worstState: TranslationState;
  invariantIssues: number;
  questions: LanguageQuestionStatus[];
}

export interface TranslationReport {
  paperId: string;
  translations: PaperTranslationsDoc | null;
  languages: LanguageReadiness[];
  totals: {
    languages: number;
    questions: number;
    fullyApprovedLanguages: number;
    invariantIssues: number;
  };
}

export interface PaperTranslationsDoc {
  languages: Record<
    string,
    { state?: TranslationState; note?: string | null; sections?: Record<string, string>; updatedAt?: string }
  >;
}

/** Language-resolved paper question (strict mode may route to unresolved). */
export interface LanguageQuestion {
  id: string;
  family_id: string;
  sort_order: number;
  marks: number;
  resolved_language_id: string | null;
  substituted: boolean;
  translation_status: TranslationState;
  section_key: string | null;
  question: PaperFamilyVariant;
}

export interface LanguageUnresolved {
  family_id: string;
  sort_order: number;
  reason: "translation_missing" | "no_variants";
  available_languages: string[];
}

export interface PaperInLanguageStrict {
  paper: Paper;
  questions: LanguageQuestion[];
  unresolved: LanguageUnresolved[];
  requested_language_id: string;
  mode: "strict" | "substitute";
  complete: boolean;
}

// -------------------------------------------------------------------------
// Separate language paper generation (Paper Generator Phase 9)
// -------------------------------------------------------------------------
export type LanguagePaperStatus = "draft" | "generated" | "approved" | "archived";

export interface LanguagePaperSummary {
  id: string;
  master_paper_id: string;
  language_id: string;
  version: number;
  set_key: string | null;
  status: LanguagePaperStatus;
  generated_by: string | null;
  generated_at: string;
  updated_at: string;
  snapshot: {
    language_id: string;
    master_paper_id: string;
    set_key: string | null;
    complete: boolean;
    missing_count: number;
    substituted_count: number;
    question_count: number;
    total_marks: number;
    sections: { key: string; name: string; negativeMarks: number; questionCount: number }[];
    questions: {
      family_id: string;
      number: number;
      marks: number;
      section_key: string | null;
      resolved_variant_id: string | null;
      resolved_language_id: string | null;
      substituted: boolean;
      invariant_issues: { field: string; problem: string; action: string }[];
      content_hash: string | null;
      translation_status: TranslationState | "missing";
    }[];
  } | null;
  language: { id: string; code: string | null; name: string };
}

export interface LanguagePaperList {
  paperId: string;
  masterTitle: string;
  languages: { id: string; code: string | null; name: string }[];
  migrationRequired: boolean;
  papers: LanguagePaperSummary[];
}

export interface LanguagePaperGenerateResult {
  paperId: string;
  language: { id: string; code: string | null; name: string };
  version: number;
  status: LanguagePaperStatus;
  setKey: string | null;
  warnings: string[];
  snapshot: LanguagePaperSummary["snapshot"];
}

export interface LanguagePaperQuestion {
  family_id: string;
  number: number;
  sort_order: number;
  marks: number;
  negative_marks: number;
  section_key: string | null;
  resolved_language_id: string | null;
  substituted: boolean;
  translation_status: TranslationState | "missing";
  invariant_issues: { field: string; problem: string; action: string }[];
  content_hash: string | null;
  question: PaperFamilyVariant | null;
  answer: string | null;
  displayOptions: { label: string; content: unknown; originalLabel: string }[] | null;
}

export interface LanguagePaperDetail {
  paper: { id: string; title: string; description: string | null; duration_min: number; total_marks: number; status: PaperStatus };
  language: { id: string; code: string | null; name: string } | string;
  version: number;
  status: LanguagePaperStatus;
  generated_at: string;
  set_key: string | null;
  complete: boolean;
  missing_count: number;
  substituted_count: number;
  sections: { key: string; name: string; negativeMarks: number; questionCount: number }[];
  sectionInstructions: Record<string, string>;
  questions: LanguagePaperQuestion[];
  missing: LanguagePaperQuestion[];
}

// -------------------------------------------------------------------------
// Reusable paper templates & branding (Paper Generator Phase 11)
// -------------------------------------------------------------------------
export type PaperTemplateKind = "single" | "bilingual" | "custom";

export type PaperTemplateLayoutId = "single-column" | "bilingual-two-column" | "custom";

export interface PaperTemplatePageConfig {
  paperSize?: "A4" | "A3" | "Letter";
  orientation?: "portrait" | "landscape";
  margins?: { top?: number; right?: number; bottom?: number; left?: number };
  showPageNumbers?: boolean;
}

export interface PaperTemplateHeaderConfig {
  showLogo?: boolean;
  logoDataUrl?: string | null;
  logoWidthPx?: number;
  instituteName?: string | null;
  examTitle?: string | null;
  showMeta?: boolean;
}

export interface PaperTemplateConfig {
  page?: PaperTemplatePageConfig;
  layout?: { id?: PaperTemplateLayoutId; columnsGapMm?: number };
  typography?: { baseFontPt?: number; lineHeight?: number };
  header?: PaperTemplateHeaderConfig;
  footer?: { leftText?: string | null; centerText?: string | null; rightText?: string | null };
  branding?: { instituteName?: string | null; batch?: string | null; academicYear?: string | null };
  instructions?: { show?: boolean; left?: string[] | null; right?: string[] | null };
  questionSpacing?: { gapPx?: number; optionGapPx?: number };
  sections?: { style?: "bordered" | "minimal" | "text"; uppercase?: boolean };
}

export interface PaperTemplate {
  id: string;
  name: string;
  description: string | null;
  kind: PaperTemplateKind;
  config: PaperTemplateConfig;
  is_default: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaperTemplateInput {
  name: string;
  description?: string | null;
  kind?: PaperTemplateKind;
  config?: PaperTemplateConfig;
  is_default?: boolean;
}

// -------------------------------------------------------------------------
// Paper structure (Paper Generator Phase 4)
// -------------------------------------------------------------------------
export interface StructureFamily {
  family_id: string;
  sort_order: number;
  marks: number;
  effectiveMarks: number;
  number: number;
  title: string | null;
}

export interface StructureSection {
  key: string;
  name: string;
  instructions: string;
  marksPerQuestion: number;
  negativeMarks: number;
  types: string[];
  difficulties: string[];
  families: StructureFamily[];
  questionCount: number;
  marksTotal: number;
}

export interface PaperStructureTotals {
  totalQuestions: number;
  totalMarks: number;
  maxScore: number;
  minScore: number;
  negativeMarksTotal: number;
  sectionsCount: number;
}

export interface PaperStructure {
  sections: StructureSection[];
  totals: PaperStructureTotals;
  warnings: string[];
}

export interface PaperWithFamilies extends Paper {
  families: PaperFamily[];
}

/** Actual backend payload shape for papers GET/POST/PATCH: { paper, families }. */
export interface PaperPayload {
  paper: Paper;
  families: PaperFamily[];
}

export interface PaperInput {
  title: string;
  description?: string | null;
  standard_id?: string | null;
  subject_id?: string | null;
  exam_type_id?: string | null;
  duration_min?: number;
  total_marks?: number;
  status?: PaperStatus;
  /** Family references: legacy string ids or { familyId, marks, sectionKey, locked } entries. */
  familyIds?: (
    | string
    | { familyId: string; marks?: number; sectionKey?: string | null; locked?: boolean }
  )[];
}

export interface PaperQuestion {
  id: string;
  family_id: string;
  sort_order: number;
  marks: number;
  resolved_language_id: string | null;
  question: PaperFamilyVariant;
}

export interface PaperInLanguage {
  paper: Paper;
  questions: PaperQuestion[];
  missing_families: string[];
}

export interface PaperLanguages {
  languages: string[];
  coverage: { family_id: string; languages: string[] }[];
}

// -------------------------------------------------------------------------
// Question selection / generation (Paper Generator Phase 3)
// -------------------------------------------------------------------------
export interface GenerationShortage {
  ruleId: string | null;
  sectionId: string;
  scope: string;
  chapterId: string | null;
  topicId: string | null;
  type: string | null;
  difficulty: string | null;
  demanded: number;
  filled: number;
  missing: number;
}

export interface GenerateOptions {
  /** Families already in the paper (locked) — demand is consumed by them first. */
  lockFamilyIds?: string[];
  /** Deterministic seed; defaults to `paper:<id>`. */
  seed?: string;
  /** "seeded" (deterministic, default) or "random" (fresh shuffle). */
  strategy?: "seeded" | "random";
}

export interface GenerateResult {
  generated: { seed: string; strategy: string; total: number; totalMarks: number };
  families: PaperFamily[];
  paper: Paper;
}

// -------------------------------------------------------------------------
// Paper Blueprint (Paper Generator Phase 2)
// -------------------------------------------------------------------------
export type BlueprintMode = "count" | "percent";

export interface BlueprintSection {
  id: string;
  name: string;
  instructions: string;
  marksPerQuestion: number;
  negativeMarks: number;
  ruleIds: string[];
  questionCount?: number;
}

export interface BlueprintRule {
  id: string;
  sectionId: string | null;
  scope: "paper" | "chapter" | "topic";
  chapterId: string | null;
  topicId: string | null;
  type: string | null;
  difficulty: string | null;
  count: number;
  percent: number;
}

export interface PaperBlueprint {
  version: number;
  totalQuestions: number;
  mode: BlueprintMode;
  sections: BlueprintSection[];
  rules: BlueprintRule[];
}

export interface BlueprintSummary {
  totalQuestions: number;
  sectionTotal: number;
  totalMarksEstimate: number;
  marksPerQuestion: number[];
}

export interface BlueprintValidation {
  valid?: boolean;
  errors: string[];
  warnings: string[];
  normalizationErrors?: string[];
  summary: BlueprintSummary | null;
}

export interface BlueprintAvailabilityRow {
  ruleId: string;
  sectionId: string | null;
  available: number | null;
  demanded: number | null;
  shortfall: number;
}

export interface BlueprintPreview {
  validation: { errors: string[]; warnings: string[]; summary: BlueprintSummary | null };
  sections: {
    id: string;
    name: string;
    marksPerQuestion: number;
    negativeMarks: number;
    questionCount: number;
    marks: number;
  }[];
  availability: { rules: BlueprintAvailabilityRow[]; sectionShortfalls: Record<string, number> };
}

export const api = {
  login(email: string, password: string): Promise<LoginResponse> {
    return request<LoginResponse>("/auth/login", {
      method: "POST",
      body: { email, password },
      auth: false,
    });
  },
  me(): Promise<{ user: AdminUser; role: UserRole; permissions: string[] }> {
    return request("/auth/me");
  },
  updateProfile(input: UpdateProfileInput): Promise<{ user: AdminUser; role: UserRole; permissions: string[] }> {
    return request("/auth/me", { method: "PATCH", body: input });
  },
  changePassword(currentPassword: string, newPassword: string): Promise<{ ok: boolean }> {
    return request("/auth/change-password", {
      method: "POST",
      body: { currentPassword, newPassword },
    });
  },
  forgotPassword(email: string): Promise<{ ok: boolean }> {
    return request("/auth/forgot-password", {
      method: "POST",
      body: { email },
      auth: false,
    });
  },
  resetPassword(token: string, password: string): Promise<{ ok: boolean }> {
    return request("/auth/reset-password", {
      method: "POST",
      body: { token, password },
      auth: false,
    });
  },
  health(): Promise<{ ok: boolean }> {
    return request("/health", { auth: false });
  },
  // Master Data
  standards: {
    list(): Promise<{ standards: Standard[] }> {
      return request("/admin/standards");
    },
    create(data: { name: string; sort_order?: number }): Promise<{ standard: Standard }> {
      return request("/admin/standards", { method: "POST", body: data });
    },
    update(id: string, data: Partial<Standard>): Promise<{ standard: Standard }> {
      return request(`/admin/standards/${id}`, { method: "PATCH", body: data });
    },
    delete(id: string): Promise<{ deleted: boolean }> {
      return request(`/admin/standards/${id}`, { method: "DELETE" });
    },
  },
  standardSubjects: {
    list(params?: { standard_id?: string; subject_id?: string }): Promise<{ mappings: StandardSubjectMapping[] }> {
      const qs = new URLSearchParams();
      if (params?.standard_id) qs.set("standard_id", params.standard_id);
      if (params?.subject_id) qs.set("subject_id", params.subject_id);
      const q = qs.toString();
      return request(`/admin/standard-subjects${q ? `?${q}` : ""}`);
    },
  },
  subjects: {
    list(): Promise<{ subjects: Subject[] }> {
      return request("/admin/subjects");
    },
    create(data: { name: string; icon?: string; color?: string; sort_order?: number; standard_ids?: string[] }): Promise<{ subject: Subject }> {
      return request("/admin/subjects", { method: "POST", body: data });
    },
    update(id: string, data: Partial<Subject> & { standard_ids?: string[] }): Promise<{ subject: Subject }> {
      return request(`/admin/subjects/${id}`, { method: "PATCH", body: data });
    },
    delete(id: string): Promise<{ deleted: boolean }> {
      return request(`/admin/subjects/${id}`, { method: "DELETE" });
    },
  },
  chapters: {
    list(params?: { subject_id?: string; standard_id?: string; resource_type_ids?: string[] }): Promise<{ chapters: Chapter[] }> {
      const qs = new URLSearchParams();
      if (params?.subject_id) qs.set("subject_id", params.subject_id);
      if (params?.standard_id) qs.set("standard_id", params.standard_id);
      if (params?.resource_type_ids?.length) qs.set("resource_type_ids", params.resource_type_ids.join(","));
      const q = qs.toString();
      return request(`/admin/chapters${q ? `?${q}` : ""}`);
    },
    create(data: { subject_id: string; standard_id: string; resource_type_ids?: string[]; name: string; number?: number; description?: string; sort_order?: number }): Promise<{ chapter: Chapter }> {
      return request("/admin/chapters", { method: "POST", body: data });
    },
    update(id: string, data: Partial<Chapter>): Promise<{ chapter: Chapter }> {
      return request(`/admin/chapters/${id}`, { method: "PATCH", body: data });
    },
    delete(id: string): Promise<{ deleted: boolean }> {
      return request(`/admin/chapters/${id}`, { method: "DELETE" });
    },
  },
  topics: {
    list(params?: { chapter_id?: string }): Promise<{ topics: Topic[] }> {
      const qs = new URLSearchParams();
      if (params?.chapter_id) qs.set("chapter_id", params.chapter_id);
      const q = qs.toString();
      return request(`/admin/topics${q ? `?${q}` : ""}`);
    },
    create(data: { chapter_id: string; name: string; number?: string; description?: string; sort_order?: number }): Promise<{ topic: Topic }> {
      return request("/admin/topics", { method: "POST", body: data });
    },
    update(id: string, data: Partial<Topic>): Promise<{ topic: Topic }> {
      return request(`/admin/topics/${id}`, { method: "PATCH", body: data });
    },
    delete(id: string): Promise<{ deleted: boolean }> {
      return request(`/admin/topics/${id}`, { method: "DELETE" });
    },
  },
  examTypes: {
    list(): Promise<{ examTypes: ExamType[] }> {
      return request("/admin/exam-types");
    },
    create(data: { name: string; category?: string; description?: string; sort_order?: number }): Promise<{ examType: ExamType }> {
      return request("/admin/exam-types", { method: "POST", body: data });
    },
    update(id: string, data: Partial<ExamType>): Promise<{ examType: ExamType }> {
      return request(`/admin/exam-types/${id}`, { method: "PATCH", body: data });
    },
    delete(id: string): Promise<{ deleted: boolean }> {
      return request(`/admin/exam-types/${id}`, { method: "DELETE" });
    },
  },
  resourceTypes: {
    list(): Promise<{ resourceTypes: ResourceType[] }> {
      return request("/admin/resource-types");
    },
    create(data: { name: string; code?: string; description?: string; sort_order?: number }): Promise<{ resourceType: ResourceType }> {
      return request("/admin/resource-types", { method: "POST", body: data });
    },
    update(id: string, data: Partial<ResourceType>): Promise<{ resourceType: ResourceType }> {
      return request(`/admin/resource-types/${id}`, { method: "PATCH", body: data });
    },
    delete(id: string): Promise<{ deleted: boolean }> {
      return request(`/admin/resource-types/${id}`, { method: "DELETE" });
    },
  },
  tags: {
    list(): Promise<{ tags: string[] }> {
      return request("/admin/tags");
    },
  },
  languages: {
    list(): Promise<{ languages: Language[] }> {
      return request("/admin/languages");
    },
    create(data: { code: string; name: string; native_name?: string }): Promise<{ language: Language }> {
      return request("/admin/languages", { method: "POST", body: data });
    },
    update(id: string, data: Partial<Language>): Promise<{ language: Language }> {
      return request(`/admin/languages/${id}`, { method: "PATCH", body: data });
    },
    delete(id: string): Promise<{ deleted: boolean }> {
      return request(`/admin/languages/${id}`, { method: "DELETE" });
    },
  },
  questionLevels: {
    list(): Promise<{ levels: QuestionLevel[] }> {
      return request("/admin/question-levels");
    },
    create(data: { code: string; name: string; color?: string; icon?: string; sort_order?: number }): Promise<{ level: QuestionLevel }> {
      return request("/admin/question-levels", { method: "POST", body: data });
    },
  },
  schools: {
    list(): Promise<{ schools: School[] }> {
      return request("/admin/schools");
    },
    create(data: { name: string; code?: string; district?: string; city?: string; state?: string; board?: string; type?: string; contact_email?: string; contact_phone?: string; address?: string }): Promise<{ school: School }> {
      return request("/admin/schools", { method: "POST", body: data });
    },
    update(id: string, data: Partial<School>): Promise<{ school: School }> {
      return request(`/admin/schools/${id}`, { method: "PATCH", body: data });
    },
    delete(id: string): Promise<{ deleted: boolean }> {
      return request(`/admin/schools/${id}`, { method: "DELETE" });
    },
  },

  questions: {
    list(filters?: QuestionFilters): Promise<QuestionListResponse> {
      const qs = new URLSearchParams();
      if (filters) {
        for (const [k, v] of Object.entries(filters)) {
          if (v === undefined || v === null || v === "") continue;
          if (k === "tags" && Array.isArray(v)) qs.set(k, v.join(","));
          else qs.set(k, String(v));
        }
      }
      const q = qs.toString();
      return request(`/admin/questions${q ? `?${q}` : ""}`);
    },
    aggregate(filters?: QuestionFilters, include?: QuestionAggregateDim[]): Promise<QuestionAggregateCounts> {
      const qs = new URLSearchParams();
      if (filters) {
        for (const [k, v] of Object.entries(filters)) {
          if (v === undefined || v === null || v === "") continue;
          if (k === "tags" && Array.isArray(v)) qs.set(k, v.join(","));
          else if (k === "limit" || k === "offset" || k === "with_usage") continue;
          else qs.set(k, String(v));
        }
      }
      if (include && include.length > 0) qs.set("include", include.join(","));
      const q = qs.toString();
      return request(`/admin/questions/aggregate${q ? `?${q}` : ""}`);
    },
    get(id: string): Promise<{ question: Question; options: QuestionOption[]; payload: unknown }> {
      return request(`/admin/questions/${id}`);
    },
    variants(id: string): Promise<{ family_id: string | null; variants: QuestionVariant[] }> {
      return request(`/admin/questions/${id}/variants`);
    },
    linkVariant(id: string, familyId?: string | null): Promise<{ question: Question; family_id: string | null }> {
      return request(`/admin/questions/${id}/link-variant`, {
        method: "POST",
        body: { family_id: familyId ?? null },
      });
    },
    create(data: Partial<Question> & { options?: { label: string; content: unknown; is_correct: boolean }[]; payload?: unknown }): Promise<{ question: Question; options: QuestionOption[]; payload: unknown }> {
      return request("/admin/questions", { method: "POST", body: data });
    },
    update(id: string, data: Partial<Question> & { options?: { label: string; content: unknown; is_correct: boolean }[]; payload?: unknown }): Promise<{ question: Question; options: QuestionOption[]; payload: unknown }> {
      return request(`/admin/questions/${id}`, { method: "PATCH", body: data });
    },
    delete(id: string): Promise<{ deleted: boolean }> {
      return request(`/admin/questions/${id}`, { method: "DELETE" });
    },
    duplicate(id: string): Promise<{ question: Question }> {
      return request(`/admin/questions/${id}/duplicate`, { method: "POST" });
    },
    history(id: string): Promise<{ usage: unknown[]; edits: unknown[]; performance: unknown }> {
      return request(`/admin/questions/${id}/history`);
    },
    usage(id: string): Promise<{ total: number; teachers: { id: string; count: number }[]; schools: { id: string; count: number }[] }> {
      return request(`/admin/questions/${id}/usage`);
    },
  },

  analytics: {
    overview(): Promise<AnalyticsOverview> {
      return request("/admin/analytics/overview");
    },
    mostUsed(limit = 10): Promise<{ questions: (Question & { usage_count: number })[] }> {
      return request(`/admin/analytics/most-used?limit=${limit}`);
    },
    unused(limit = 25): Promise<{ questions: Question[] }> {
      return request(`/admin/analytics/unused?limit=${limit}`);
    },
    bySchool(): Promise<{ schools: SchoolUsageRow[] }> {
      return request("/admin/analytics/by-school");
    },
    byTeacher(): Promise<{ teachers: TeacherUsageRow[] }> {
      return request("/admin/analytics/by-teacher");
    },
    overTime(): Promise<OverTimeData> {
      return request("/admin/analytics/over-time");
    },
    performance(): Promise<PerformanceData> {
      return request("/admin/analytics/performance");
    },
  },

  tests: {
    list(params?: { status?: TestStatus; limit?: number; offset?: number }): Promise<{ tests: Test[]; total: number }> {
      const qs = new URLSearchParams();
      if (params?.status) qs.set("status", params.status);
      if (params?.limit) qs.set("limit", String(params.limit));
      if (params?.offset) qs.set("offset", String(params.offset));
      const q = qs.toString();
      return request(`/admin/tests${q ? `?${q}` : ""}`);
    },
    get(id: string): Promise<TestWithQuestions> {
      return request(`/admin/tests/${id}`);
    },
    create(data: TestInput): Promise<TestWithQuestions> {
      return request("/admin/tests", { method: "POST", body: data });
    },
    update(id: string, data: Partial<TestInput>): Promise<TestWithQuestions> {
      return request(`/admin/tests/${id}`, { method: "PATCH", body: data });
    },
    delete(id: string): Promise<{ deleted: boolean }> {
      return request(`/admin/tests/${id}`, { method: "DELETE" });
    },
  },

  papers: {
    list(params?: { status?: PaperStatus; limit?: number; offset?: number }): Promise<{ papers: Paper[]; total: number }> {
      const qs = new URLSearchParams();
      if (params?.status) qs.set("status", params.status);
      if (params?.limit) qs.set("limit", String(params.limit));
      if (params?.offset) qs.set("offset", String(params.offset));
      const q = qs.toString();
      return request(`/admin/papers${q ? `?${q}` : ""}`);
    },
    get(id: string): Promise<PaperPayload> {
      return request(`/admin/papers/${id}`);
    },
    create(data: PaperInput): Promise<PaperPayload> {
      return request("/admin/papers", { method: "POST", body: data });
    },
    update(id: string, data: Partial<PaperInput>): Promise<PaperPayload> {
      return request(`/admin/papers/${id}`, { method: "PATCH", body: data });
    },
    delete(id: string): Promise<{ deleted: boolean }> {
      return request(`/admin/papers/${id}`, { method: "DELETE" });
    },
    print(id: string, language: string): Promise<PaperInLanguage> {
      return request(`/admin/papers/${id}/print?language=${encodeURIComponent(language)}`);
    },
    languages(id: string): Promise<PaperLanguages> {
      return request(`/admin/papers/${id}/languages`);
    },
    blueprint: {
      get(id: string): Promise<{ paper: Paper; blueprint: PaperBlueprint | null }> {
        return request(`/admin/papers/${id}/blueprint`);
      },
      save(
        id: string,
        blueprint: PaperBlueprint
      ): Promise<{ paper: Paper; blueprint: PaperBlueprint; normalizationErrors: string[]; validation: BlueprintValidation }> {
        return request(`/admin/papers/${id}/blueprint`, { method: "PUT", body: { blueprint } });
      },
      validate(id: string, blueprint: PaperBlueprint): Promise<BlueprintValidation & { valid: boolean }> {
        return request(`/admin/papers/${id}/blueprint/validate`, {
          method: "POST",
          body: { blueprint },
        });
      },
      preview(id: string, blueprint: PaperBlueprint, context?: { standardId?: string | null; subjectId?: string | null }): Promise<BlueprintPreview> {
        return request(`/admin/papers/${id}/blueprint/preview`, {
          method: "POST",
          body: { blueprint, ...context },
        });
      },
    },
    generate(
      id: string,
      options: GenerateOptions = {}
    ): Promise<GenerateResult> {
      return request(`/admin/papers/${id}/generate`, { method: "POST", body: options });
    },
    structure(id: string): Promise<PaperStructure & { paper: Paper; blueprint: PaperBlueprint | null; migrationRequired?: boolean }> {
      return request(`/admin/papers/${id}/structure`);
    },
    validate(id: string, requiredLanguages?: string[]): Promise<ValidationReport> {
      const qs = requiredLanguages?.length
        ? `?${requiredLanguages.map((l) => `requiredLanguage=${encodeURIComponent(l)}`).join("&")}`
        : "";
      return request(`/admin/papers/${id}/validate${qs}`);
    },
    setFamilies(
      id: string,
      families: (string | { familyId: string; marks?: number; sectionKey?: string | null; locked?: boolean })[]
    ): Promise<PaperPayload> {
      return request(`/admin/papers/${id}/families`, { method: "PUT", body: { families } });
    },
    replaceFamily(
      id: string,
      familyId: string,
      options: { dryRun?: boolean; seed?: string } = {}
    ): Promise<ReplaceDryRun | ReplaceResult> {
      return request(`/admin/papers/${id}/families/${familyId}/replace`, {
        method: "POST",
        body: options,
      });
    },
    sets: {
      get(id: string): Promise<{ paperId: string; sets: PaperSetsDoc | null; migrationRequired: boolean }> {
        return request(`/admin/papers/${id}/sets`);
      },
      generate(id: string, options: GenerateSetsOptions = {}): Promise<{ paperId: string; sets: PaperSetsDoc; warnings: string[]; migrationRequired: boolean }> {
        return request(`/admin/papers/${id}/sets`, { method: "POST", body: options });
      },
      clear(id: string): Promise<{ deleted: boolean; paperId: string }> {
        return request(`/admin/papers/${id}/sets`, { method: "DELETE" });
      },
      answerKey(id: string, setKey: string): Promise<SetAnswerKey> {
        return request(`/admin/papers/${id}/sets/${encodeURIComponent(setKey)}/answer-key`);
      },
      answerKeyInLanguage(id: string, setKey: string, language: string): Promise<SetAnswerKey> {
        return request(`/admin/papers/${id}/sets/${encodeURIComponent(setKey)}/answer-key?language=${encodeURIComponent(language)}`);
      },
    },
    translations: {
      report(id: string): Promise<TranslationReport> {
        return request(`/admin/papers/${id}/translations`);
      },
      save(id: string, translations: PaperTranslationsDoc | null): Promise<{ saved: boolean; translations: PaperTranslationsDoc | null }> {
        return request(`/admin/papers/${id}/translations`, { method: "PUT", body: { translations } });
      },
    },
    language(
      id: string,
      language: string,
      mode: "strict" | "substitute" = "substitute"
    ): Promise<PaperInLanguageStrict> {
      const qs = `language=${encodeURIComponent(language)}${mode === "strict" ? "&mode=strict" : ""}`;
      return request(`/admin/papers/${id}/language?${qs}`);
    },
    setVariantTranslationStatus(id: string, status: Exclude<TranslationState, "missing">): Promise<{ question: Question }> {
      return request(`/admin/questions/${id}/translation-status`, { method: "PATCH", body: { status } });
    },
    languagePapers: {
      list(id: string): Promise<LanguagePaperList> {
        return request(`/admin/papers/${id}/language-papers`);
      },
      generate(
        id: string,
        input: { languageId: string; setKey?: string | null; mode?: "strict" | "substitute" }
      ): Promise<LanguagePaperGenerateResult> {
        return request(`/admin/papers/${id}/language-papers`, { method: "POST", body: input });
      },
      get(id: string, version: number): Promise<LanguagePaperDetail> {
        return request(`/admin/papers/${id}/language-papers/${version}`);
      },
      setStatus(id: string, version: number, status: LanguagePaperStatus): Promise<{ paperId: string; version: number; status: LanguagePaperStatus }> {
        return request(`/admin/papers/${id}/language-papers/${version}`, { method: "PATCH", body: { status } });
      },
      remove(id: string, version: number): Promise<{ deleted: boolean; paperId: string; version: number }> {
        return request(`/admin/papers/${id}/language-papers/${version}`, { method: "DELETE" });
      },
    },
    answerKey(id: string, options: PaperReportOptions = {}): Promise<PaperReport> {
      return reportRequest("/answer-key", id, options);
    },
    solutions(id: string, options: PaperReportOptions = {}): Promise<PaperReport> {
      return reportRequest("/solutions", id, options);
    },
    analysis(id: string): Promise<PaperAnalysis> {
      return request(`/admin/papers/${id}/analysis`);
    },
    versions: {
      list(id: string): Promise<PaperVersionsList> {
        return request(`/admin/papers/${id}/versions`);
      },
      get(id: string, version: number): Promise<PaperVersionDetail> {
        return request(`/admin/papers/${id}/versions/${version}`);
      },
      create(id: string, input: PaperVersionCreateInput = {}): Promise<PaperVersionCreateResult> {
        return request(`/admin/papers/${id}/versions`, { method: "POST", body: input });
      },
      restore(id: string, version: number, note?: string): Promise<PaperVersionRestoreResult> {
        return request(`/admin/papers/${id}/versions/${version}/restore`, { method: "POST", body: note ? { note } : {} });
      },
    },
    /** Run validation and promote a paper to "validated" (blocks critical errors). */
    validateAndPromote(id: string): Promise<PaperValidateResult> {
      return request(`/admin/papers/${id}/validate`, { method: "POST", body: {} });
    },
    /** Duplicate a paper as a new draft. */
    duplicate(id: string): Promise<PaperPayload> {
      return request(`/admin/papers/${id}/duplicate`, { method: "POST", body: {} });
    },
    archive(id: string): Promise<PaperTransitionResult> {
      return request(`/admin/papers/${id}/archive`, { method: "POST", body: {} });
    },
    restore(id: string): Promise<PaperTransitionResult> {
      return request(`/admin/papers/${id}/restore`, { method: "POST", body: {} });
    },
    /** Export a paper to PDF (server-rendered). Optional language resolves the content. */
    pdf(id: string, options: { language?: string; mode?: "strict" | "substitute" } = {}): Promise<Blob> {
      const qs: string[] = [];
      if (options.language) qs.push(`language=${encodeURIComponent(options.language)}`);
      if (options.mode) qs.push(`mode=${encodeURIComponent(options.mode)}`);
      return requestBlob(`/admin/papers/${id}/pdf${qs.length ? `?${qs.join("&")}` : ""}`);
    },
  },

  templates: {
    list(params?: { kind?: PaperTemplateKind }): Promise<{ templates: PaperTemplate[] }> {
      const qs = params?.kind ? `?kind=${encodeURIComponent(params.kind)}` : "";
      return request(`/admin/templates${qs}`);
    },
    default(kind: PaperTemplateKind): Promise<{ template: PaperTemplate | null }> {
      return request(`/admin/templates/default?kind=${encodeURIComponent(kind)}`);
    },
    get(id: string): Promise<{ template: PaperTemplate }> {
      return request(`/admin/templates/${id}`);
    },
    create(data: PaperTemplateInput): Promise<{ template: PaperTemplate }> {
      return request("/admin/templates", { method: "POST", body: data });
    },
    update(id: string, patch: Partial<PaperTemplateInput>): Promise<{ template: PaperTemplate }> {
      return request(`/admin/templates/${id}`, { method: "PATCH", body: patch });
    },
    delete(id: string): Promise<{ deleted: boolean; id: string }> {
      return request(`/admin/templates/${id}`, { method: "DELETE" });
    },
  },

  admin: {
    listUsers(): Promise<{ users: AdminUser[] }> {
      return request("/admin/users");
    },
    createUser(input: UserCrudInput): Promise<{ user: AdminUser; email?: { ok: boolean; error?: string } | null }> {
      return request("/admin/users", { method: "POST", body: input });
    },
    updateUser(id: string, patch: UserUpdateInput): Promise<{ user: AdminUser }> {
      return request(`/admin/users/${id}`, { method: "PATCH", body: patch });
    },
    deleteUser(id: string): Promise<{ deleted: boolean; user: AdminUser }> {
      return request(`/admin/users/${id}`, { method: "DELETE" });
    },
    setUserRole(id: string, role: UserRole): Promise<{ user: AdminUser }> {
      return request(`/admin/users/${id}/role`, { method: "PUT", body: { role } });
    },
    stats(): Promise<{ stats: Record<"teacher" | "student" | "super_admin", number> }> {
      return request("/admin/stats");
    },
    listRoles(): Promise<{ roles: Role[] }> {
      return request("/admin/roles");
    },
    createRole(data: { code: string; name: string; description?: string }): Promise<{ role: Role }> {
      return request("/admin/roles", { method: "POST", body: data });
    },
    deleteRole(code: string): Promise<{ deleted: boolean }> {
      return request(`/admin/roles/${code}`, { method: "DELETE" });
    },
    listPermissions(): Promise<{ permissions: Permission[]; matrix: PermissionMatrix }> {
      return request("/admin/permissions");
    },
    setRolePermissions(
      roleCode: string,
      permissions: string[]
    ): Promise<{ role: string; permissions: string[] }> {
      return request(`/admin/roles/${roleCode}/permissions`, {
        method: "PUT",
        body: { permissions },
      });
    },
  },
};