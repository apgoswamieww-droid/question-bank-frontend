import { createContext, useContext, useCallback } from "react";
import type { AdminUser } from "../api/client";

export interface AdminAuthState {
  user: AdminUser | null;
  token: string | null;
  permissions: string[];
  isBootstrapping: boolean;
  login: (email: string, password: string, remember?: boolean) => Promise<AdminUser>;
  logout: () => void;
}

export const PERMISSIONS = {
  USERS_VIEW: "users.view",
  USERS_MANAGE: "users.manage",
  ROLES_MANAGE: "roles.manage",
  QUESTION_BANKS_VIEW: "question_banks.view",
  QUESTION_BANKS_MANAGE: "question_banks.manage",
  // Paper Generator (Phase 17) — mirrors backend supabase.js PERMISSIONS.
  PAPERS_VIEW: "papers.view",
  PAPERS_MANAGE: "papers.manage",
  PAPERS_DELETE: "papers.delete",
  PAPERS_PUBLISH: "papers.publish",
  PAPERS_GENERATE: "papers.generate",
  PAPERS_EXPORT: "papers.export",
  PAPERS_TEMPLATES_MANAGE: "papers.templates.manage",
  PAPERS_TRANSLATIONS_MANAGE: "papers.translations.manage",
  PAPERS_REPORTS_VIEW: "papers.reports.view",
  SETTINGS_VIEW: "settings.view",
} as const;

export const AdminAuthContext = createContext<AdminAuthState | null>(null);

export function useAdminAuth(): AdminAuthState {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) {
    throw new Error("useAdminAuth must be used within <AdminAuthProvider>");
  }
  return ctx;
}

// Permission helper for the current user. Super admin always passes.
export function useCan(): (permission: string) => boolean {
  const { user, permissions } = useAdminAuth();
  return useCallback(
    (permission: string) => {
      if (user?.role === "super_admin") return true;
      return permissions.includes(permission);
    },
    [user?.role, permissions]
  );
}
