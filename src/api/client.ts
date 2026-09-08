const TOKEN_KEY = "qb.admin.token";
const USER_KEY = "qb.admin.user";
const PERMS_KEY = "qb.admin.permissions";

export type UserRole = "super_admin" | "teacher" | "student" | "parent" | (string & {});

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

  constructor(message: string, code: string, status: number, retryAfter?: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.retryAfter = retryAfter;
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

  const response = await fetch(`/api${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: "same-origin",
  });

  if (response.status === 401 && auth) {
    clearSession();
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    let code = "UNKNOWN";
    let retryAfter: number | undefined;
    try {
      const data = (await response.json()) as {
        error?: string;
        code?: string;
        retryAfter?: number;
      };
      if (data.error) message = data.error;
      if (data.code) code = data.code;
      if (data.retryAfter) retryAfter = data.retryAfter;
    } catch {
      /* non-JSON error body — keep default message */
    }
    throw new ApiError(message, code, response.status, retryAfter);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
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

export interface Chapter {
  id: string;
  subject_id: string;
  standard_id: string;
  name: string;
  number: number | null;
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
  created_at: string;
  updated_at: string;
}

export interface QuestionOption {
  id: string;
  question_id: string;
  label: string;
  content: unknown;
  is_correct: boolean;
  sort_order: number;
}

export interface QuestionFilters {
  bank_id?: string;
  standard_id?: string;
  subject_id?: string;
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
  limit?: number;
  offset?: number;
}

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
  subjects: {
    list(): Promise<{ subjects: Subject[] }> {
      return request("/admin/subjects");
    },
    create(data: { name: string; icon?: string; color?: string; sort_order?: number }): Promise<{ subject: Subject }> {
      return request("/admin/subjects", { method: "POST", body: data });
    },
    update(id: string, data: Partial<Subject>): Promise<{ subject: Subject }> {
      return request(`/admin/subjects/${id}`, { method: "PATCH", body: data });
    },
    delete(id: string): Promise<{ deleted: boolean }> {
      return request(`/admin/subjects/${id}`, { method: "DELETE" });
    },
  },
  chapters: {
    list(params?: { subject_id?: string; standard_id?: string }): Promise<{ chapters: Chapter[] }> {
      const qs = new URLSearchParams();
      if (params?.subject_id) qs.set("subject_id", params.subject_id);
      if (params?.standard_id) qs.set("standard_id", params.standard_id);
      const q = qs.toString();
      return request(`/admin/chapters${q ? `?${q}` : ""}`);
    },
    create(data: { subject_id: string; standard_id: string; name: string; number?: number; description?: string; sort_order?: number }): Promise<{ chapter: Chapter }> {
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
    list(filters?: QuestionFilters): Promise<{ questions: Question[]; total: number; limit: number; offset: number }> {
      const qs = new URLSearchParams();
      if (filters) {
        for (const [k, v] of Object.entries(filters)) {
          if (v !== undefined && v !== null && v !== "") {
            if (k === "tags" && Array.isArray(v)) qs.set(k, v.join(","));
            else qs.set(k, String(v));
          }
        }
      }
      const q = qs.toString();
      return request(`/admin/questions${q ? `?${q}` : ""}`);
    },
    get(id: string): Promise<{ question: Question; options: QuestionOption[]; payload: unknown }> {
      return request(`/admin/questions/${id}`);
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
    stats(): Promise<{ stats: Record<"teacher" | "student" | "parent" | "super_admin", number> }> {
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