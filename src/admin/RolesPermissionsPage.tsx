import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ShieldCheck,
  Plus,
  Save,
  Trash2,
  CheckSquare,
  Square,
  Lock,
  Search,
  Users,
  Building2,
  BookOpenCheck,
  ClipboardList,
  BarChart3,
  Layers,
  Settings,
  Shield,
  RotateCcw,
  Sparkles,
  LayoutGrid,
  Table as TableIcon,
  X,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import {
  api,
  ApiError,
  type Permission,
  type Role,
} from "../api/client";
import { PageHeader } from "./components/PageHeader";
import { Button } from "./components/Button";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { TableSkeleton } from "./components/Skeleton";
import { getRoleMeta, SYSTEM_ROLES } from "./components/roleMeta";
import { useCan } from "../context/useAdminAuth";

interface ModuleConfig {
  icon: typeof Users;
  color: string;
  badge: string;
  description: string;
}

const MODULE_CONFIGS: Record<string, ModuleConfig> = {
  "Users Management": {
    icon: Users,
    color: "text-blue-600 bg-blue-50 ring-blue-200",
    badge: "bg-blue-100 text-blue-700",
    description: "Manage teachers and students access",
  },
  "Schools Management": {
    icon: Building2,
    color: "text-amber-600 bg-amber-50 ring-amber-200",
    badge: "bg-amber-100 text-amber-700",
    description: "Manage school registrations, profiles and affiliations",
  },
  "Question Bank & Editor": {
    icon: BookOpenCheck,
    color: "text-purple-600 bg-purple-50 ring-purple-200",
    badge: "bg-purple-100 text-purple-700",
    description: "Question entry wizard, bank catalog and paper editor",
  },
  "Tests & Exam Papers": {
    icon: ClipboardList,
    color: "text-emerald-600 bg-emerald-50 ring-emerald-200",
    badge: "bg-emerald-100 text-emerald-700",
    description: "Create, configure, publish and manage exams",
  },
  "Analytics & Reports": {
    icon: BarChart3,
    color: "text-cyan-600 bg-cyan-50 ring-cyan-200",
    badge: "bg-cyan-100 text-cyan-700",
    description: "Question usage statistics, trends and performance",
  },
  "Academic Hierarchy": {
    icon: Layers,
    color: "text-indigo-600 bg-indigo-50 ring-indigo-200",
    badge: "bg-indigo-100 text-indigo-700",
    description: "Standards, subjects, chapters and syllabus topics",
  },
  "System & Settings": {
    icon: Settings,
    color: "text-slate-600 bg-slate-100 ring-slate-200",
    badge: "bg-slate-200 text-slate-700",
    description: "Exam types, languages, roles and platform settings",
  },
};

const DEFAULT_MODULE_CONFIG: ModuleConfig = {
  icon: Shield,
  color: "text-slate-600 bg-slate-100 ring-slate-200",
  badge: "bg-slate-200 text-slate-700",
  description: "General module permissions",
};

export function RolesPermissionsPage() {
  const can = useCan();
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [matrix, setMatrix] = useState<Record<string, string[]>>({});
  const [draft, setDraft] = useState<Record<string, string[]>>({});
  const [activeRoleCode, setActiveRoleCode] = useState<string>("super_admin");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"detail" | "matrix">("detail");
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Modals
  const [isCreateRoleOpen, setIsCreateRoleOpen] = useState(false);
  const [newRole, setNewRole] = useState({ name: "", code: "", description: "", cloneFrom: "" });
  const [creatingRole, setCreatingRole] = useState(false);
  const [deletingRole, setDeletingRole] = useState<Role | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [rolesRes, permsRes] = await Promise.all([
        api.admin.listRoles(),
        api.admin.listPermissions(),
      ]);

      setRoles(rolesRes.roles);
      setPermissions(permsRes.permissions);
      setMatrix(permsRes.matrix);
      setDraft(permsRes.matrix);

      if (rolesRes.roles.length > 0 && !activeRoleCode) {
        setActiveRoleCode(rolesRes.roles[0].code);
      }
    } catch (err) {
      setMessage({
        text: err instanceof ApiError ? err.message : "Failed to load roles and permissions.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [activeRoleCode]);

  // Deliberate initial-load pattern (repeated on user actions via `loadData`).
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadData(); }, [loadData]);

  // Group permissions by module
  const moduleGroups = useMemo(() => {
    const groups: Record<string, Permission[]> = {};
    for (const p of permissions) {
      const mod = p.module || "General";
      if (!groups[mod]) groups[mod] = [];
      groups[mod].push(p);
    }
    return groups;
  }, [permissions]);

  const activeRole = useMemo(
    () => roles.find((r) => r.code === activeRoleCode) || roles[0],
    [roles, activeRoleCode]
  );

  const isSuperAdmin = activeRoleCode === "super_admin";

  const isDirty = useMemo(() => {
    if (!activeRoleCode || isSuperAdmin) return false;
    const a = (draft[activeRoleCode] ?? []).slice().sort();
    const b = (matrix[activeRoleCode] ?? []).slice().sort();
    return JSON.stringify(a) !== JSON.stringify(b);
  }, [draft, matrix, activeRoleCode, isSuperAdmin]);

  const togglePermission = (code: string) => {
    if (isSuperAdmin) return;
    setDraft((prev) => {
      const current = prev[activeRoleCode] ?? [];
      const next = current.includes(code)
        ? current.filter((c) => c !== code)
        : [...current, code];
      return { ...prev, [activeRoleCode]: next };
    });
  };

  const toggleModulePermissions = (moduleName: string, perms: Permission[]) => {
    if (isSuperAdmin) return;
    const codes = perms.map((p) => p.code);
    const current = draft[activeRoleCode] ?? [];
    const allSelected = codes.every((c) => current.includes(c));

    let next: string[];
    if (allSelected) {
      next = current.filter((c) => !codes.includes(c));
    } else {
      next = Array.from(new Set([...current, ...codes]));
    }

    setDraft((prev) => ({ ...prev, [activeRoleCode]: next }));
  };

  const enableAllForActiveRole = () => {
    if (isSuperAdmin) return;
    const all = permissions.map((p) => p.code);
    setDraft((prev) => ({ ...prev, [activeRoleCode]: all }));
  };

  const clearAllForActiveRole = () => {
    if (isSuperAdmin) return;
    setDraft((prev) => ({ ...prev, [activeRoleCode]: [] }));
  };

  const discardChanges = () => {
    setDraft((prev) => ({ ...prev, [activeRoleCode]: matrix[activeRoleCode] ?? [] }));
  };

  const savePermissions = async () => {
    if (!activeRoleCode) return;
    setSaving(true);
    setMessage(null);
    try {
      const permsToSave = isSuperAdmin
        ? permissions.map((p) => p.code)
        : draft[activeRoleCode] ?? [];

      const res = await api.admin.setRolePermissions(activeRoleCode, permsToSave);
      setMatrix((prev) => ({ ...prev, [activeRoleCode]: res.permissions }));
      setDraft((prev) => ({ ...prev, [activeRoleCode]: res.permissions }));
      setMessage({ text: `Permissions saved successfully for ${activeRole?.name || activeRoleCode}.`, type: "success" });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({
        text: err instanceof ApiError ? err.message : "Failed to save permissions.",
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRole.name.trim() || !newRole.code.trim()) return;
    setCreatingRole(true);
    setMessage(null);
    try {
      const cleanCode = newRole.code.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
      const res = await api.admin.createRole({
        code: cleanCode,
        name: newRole.name.trim(),
        description: newRole.description.trim() || undefined,
      });

      // Clone permissions if selected
      const initialPerms = newRole.cloneFrom ? matrix[newRole.cloneFrom] ?? [] : [];
      if (initialPerms.length > 0) {
        await api.admin.setRolePermissions(cleanCode, initialPerms);
      }

      setRoles((prev) => [...prev, res.role]);
      setMatrix((prev) => ({ ...prev, [cleanCode]: initialPerms }));
      setDraft((prev) => ({ ...prev, [cleanCode]: initialPerms }));
      setActiveRoleCode(cleanCode);
      setIsCreateRoleOpen(false);
      setNewRole({ name: "", code: "", description: "", cloneFrom: "" });
      setMessage({ text: `Role "${res.role.name}" created successfully!`, type: "success" });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({
        text: err instanceof ApiError ? err.message : "Failed to create role.",
        type: "error",
      });
    } finally {
      setCreatingRole(false);
    }
  };

  const handleDeleteRole = async () => {
    if (!deletingRole) return;
    try {
      await api.admin.deleteRole(deletingRole.code);
      setRoles((prev) => prev.filter((r) => r.code !== deletingRole.code));
      if (activeRoleCode === deletingRole.code) {
        setActiveRoleCode("super_admin");
      }
      setMessage({ text: `Role "${deletingRole.name}" deleted.`, type: "success" });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({
        text: err instanceof ApiError ? err.message : "Failed to delete role.",
        type: "error",
      });
    } finally {
      setDeletingRole(null);
    }
  };

  if (loading) {
    return <TableSkeleton rows={5} cols={6} />;
  }

  if (!can("roles.manage")) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-8 text-center text-sm text-red-700">
        You do not have permission to view or manage roles.
      </div>
    );
  }

  const roleMeta = getRoleMeta(activeRole?.code || "super_admin", activeRole?.name);

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Roles & Permissions"
        subtitle="Manage access control, create custom roles and configure permissions module by module"
        actions={
          <div className="flex items-center gap-2.5">
            <div className="flex rounded-xl border border-slate-200 bg-slate-100/80 p-0.5 text-xs font-medium text-slate-600">
              <button
                type="button"
                onClick={() => setViewMode("detail")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
                  viewMode === "detail" ? "bg-white text-slate-900 shadow-sm font-semibold" : "hover:text-slate-900"
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" /> Module View
              </button>
              <button
                type="button"
                onClick={() => setViewMode("matrix")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
                  viewMode === "matrix" ? "bg-white text-slate-900 shadow-sm font-semibold" : "hover:text-slate-900"
                }`}
              >
                <TableIcon className="h-3.5 w-3.5" /> Full Matrix
              </button>
            </div>

            <Button onClick={() => setIsCreateRoleOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden /> Create New Role
            </Button>
          </div>
        }
      />

      {/* Status Notification */}
      {message && (
        <div
          role="alert"
          className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm transition shadow-sm ${
            message.type === "error"
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          {message.type === "error" ? (
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
          ) : (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* VIEW MODE 1: MODULE-WISE DETAIL VIEW */}
      {viewMode === "detail" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left Column: Roles Selector Sidebar */}
          <div className="space-y-3 lg:col-span-4 xl:col-span-3">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Available Roles</h2>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                {roles.length}
              </span>
            </div>

            <div className="space-y-2">
              {roles.map((role) => {
                const isSelected = role.code === activeRoleCode;
                const isSys = SYSTEM_ROLES.includes(role.code);
                const meta = getRoleMeta(role.code, role.name);
                const count = (draft[role.code] ?? []).length;
                const total = permissions.length;

                return (
                  <div
                    key={role.code}
                    onClick={() => setActiveRoleCode(role.code)}
                    className={`group relative flex cursor-pointer items-start justify-between gap-3 rounded-2xl border p-3.5 transition-all ${
                      isSelected
                        ? "border-primary bg-primary/[0.03] shadow-md ring-2 ring-primary/20"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70"
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-bold ${meta.chip} shadow-sm`}>
                        <ShieldCheck className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold text-slate-900">{role.name}</p>
                          {isSys ? (
                            <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.2 text-[10px] font-medium text-slate-500">
                              System
                            </span>
                          ) : (
                            <span className="shrink-0 rounded-full bg-purple-50 px-1.5 py-0.2 text-[10px] font-medium text-purple-700 ring-1 ring-purple-200">
                              Custom
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{role.description || "No description provided"}</p>
                        <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-600">
                          <span className="font-semibold text-slate-700">{role.code === "super_admin" ? "All" : count}</span>
                          <span>of {total} permissions</span>
                        </div>
                      </div>
                    </div>

                    {!isSys && (
                      <button
                        type="button"
                        title="Delete custom role"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingRole(role);
                        }}
                        className="rounded-lg p-1.5 text-slate-400 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setIsCreateRoleOpen(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50/80 p-3 text-xs font-semibold text-slate-600 transition hover:border-primary hover:bg-primary/5 hover:text-primary"
            >
              <Plus className="h-4 w-4" /> Add Another Role
            </button>
          </div>

          {/* Right Column: Module-Wise Permissions Panel */}
          <div className="space-y-5 lg:col-span-8 xl:col-span-9">
            {/* Active Role Header Card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${roleMeta.chip} shadow-md`}>
                    <ShieldCheck className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h2 className="text-lg font-bold text-slate-900">{activeRole?.name}</h2>
                      <code className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-mono text-slate-600">
                        {activeRole?.code}
                      </code>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {activeRole?.description || "Configure access permissions for this role"}
                    </p>
                  </div>
                </div>

                {/* Save / Discard buttons */}
                {!isSuperAdmin && (
                  <div className="flex items-center gap-2">
                    {isDirty && (
                      <Button variant="secondary" size="sm" onClick={discardChanges}>
                        <RotateCcw className="h-3.5 w-3.5" /> Discard
                      </Button>
                    )}
                    <Button
                      size="sm"
                      loading={saving}
                      disabled={!isDirty}
                      onClick={savePermissions}
                    >
                      <Save className="h-4 w-4" /> Save Permissions
                    </Button>
                  </div>
                )}
              </div>

              {/* Super Admin Special Notice */}
              {isSuperAdmin ? (
                <div className="mt-4 flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50/70 p-3.5 text-xs text-blue-800">
                  <Lock className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                  <div>
                    <span className="font-semibold">Super Admin Default Full Access:</span>{" "}
                    The Super Admin role is guaranteed 100% full access to all existing and future modules by default. These permissions are permanently locked and cannot be disabled.
                  </div>
                </div>
              ) : (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">Quick Actions:</span>
                    <button
                      type="button"
                      onClick={enableAllForActiveRole}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
                    >
                      Enable All
                    </button>
                    <button
                      type="button"
                      onClick={clearAllForActiveRole}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
                    >
                      Clear All
                    </button>
                  </div>

                  <div className="relative min-w-[200px]">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Filter permissions…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1 pl-8 pr-3 text-xs text-slate-900 outline-none placeholder:text-slate-400 focus:border-primary focus:bg-white"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Modules List */}
            <div className="space-y-4">
              {Object.entries(moduleGroups).map(([moduleName, modulePerms]) => {
                const config = MODULE_CONFIGS[moduleName] || DEFAULT_MODULE_CONFIG;
                const IconComponent = config.icon;

                // Filter permissions by search
                const filteredPerms = search.trim()
                  ? modulePerms.filter(
                      (p) =>
                        p.label.toLowerCase().includes(search.toLowerCase()) ||
                        p.description.toLowerCase().includes(search.toLowerCase()) ||
                        p.code.toLowerCase().includes(search.toLowerCase())
                    )
                  : modulePerms;

                if (filteredPerms.length === 0) return null;

                const currentRolePerms = isSuperAdmin
                  ? permissions.map((p) => p.code)
                  : draft[activeRoleCode] ?? [];

                const enabledCount = modulePerms.filter((p) => currentRolePerms.includes(p.code)).length;
                const isAllSelected = modulePerms.every((p) => currentRolePerms.includes(p.code));

                return (
                  <div
                    key={moduleName}
                    className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow"
                  >
                    {/* Module Header Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-xl ring-1 ${config.color}`}>
                          <IconComponent className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-slate-900">{moduleName}</h3>
                            <span className="rounded-full bg-slate-200/70 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                              {enabledCount} of {modulePerms.length} enabled
                            </span>
                          </div>
                          <p className="text-xs text-slate-500">{config.description}</p>
                        </div>
                      </div>

                      {!isSuperAdmin && (
                        <button
                          type="button"
                          onClick={() => toggleModulePermissions(moduleName, modulePerms)}
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1 text-xs font-semibold transition ${
                            isAllSelected
                              ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                              : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          {isAllSelected ? (
                            <>
                              <CheckSquare className="h-3.5 w-3.5 text-emerald-600" /> Deselect All
                            </>
                          ) : (
                            <>
                              <Square className="h-3.5 w-3.5 text-slate-400" /> Select All
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    {/* Permissions Grid */}
                    <div className="grid grid-cols-1 divide-y divide-slate-100 md:grid-cols-2 md:divide-x md:divide-y-0">
                      {filteredPerms.map((p) => {
                        const isChecked = currentRolePerms.includes(p.code);

                        return (
                          <div
                            key={p.code}
                            onClick={() => !isSuperAdmin && togglePermission(p.code)}
                            className={`flex items-start justify-between gap-3.5 p-4 transition ${
                              isSuperAdmin
                                ? "cursor-default bg-slate-50/30"
                                : "cursor-pointer hover:bg-slate-50/80"
                            } ${isChecked ? "bg-primary/[0.015]" : ""}`}
                          >
                            <div className="min-w-0 pr-2">
                              <div className="flex items-center gap-2">
                                <span className={`text-sm font-medium ${isChecked ? "text-slate-900" : "text-slate-600"}`}>
                                  {p.label}
                                </span>
                                <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-500">
                                  {p.code}
                                </code>
                              </div>
                              <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                                {p.description}
                              </p>
                            </div>

                            {/* Toggle Switch */}
                            <div className="mt-0.5 shrink-0">
                              {isSuperAdmin ? (
                                <div className="flex h-5 w-9 items-center rounded-full bg-primary/40 px-1">
                                  <Lock className="h-3 w-3 text-white" />
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  role="switch"
                                  aria-checked={isChecked}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    togglePermission(p.code);
                                  }}
                                  className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                                    isChecked ? "bg-primary" : "bg-slate-300"
                                  }`}
                                >
                                  <span
                                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${
                                      isChecked ? "translate-x-4" : "translate-x-1"
                                    }`}
                                  />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* VIEW MODE 2: COMPLETE MATRIX OVERVIEW TABLE */}
      {viewMode === "matrix" && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="sticky left-0 z-10 bg-slate-50 px-6 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-600 shadow-[1px_0_0_0_#e2e8f0]">
                    Permission / Module
                  </th>
                  {roles.map((r) => {
                    const meta = getRoleMeta(r.code, r.name);
                    return (
                      <th key={r.code} className="px-4 py-3.5 text-center text-xs font-bold uppercase tracking-wider text-slate-700">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-semibold ${meta.chip}`}>
                            {r.name}
                          </span>
                          <code className="text-[10px] font-normal text-slate-400">{r.code}</code>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {Object.entries(moduleGroups).map(([modName, perms]) => (
                  <>
                    <tr key={`header-${modName}`} className="bg-slate-100/70 font-bold text-slate-800">
                      <td colSpan={roles.length + 1} className="px-6 py-2 text-xs uppercase tracking-wider text-slate-600">
                        📁 {modName} ({perms.length})
                      </td>
                    </tr>
                    {perms.map((p) => (
                      <tr key={p.code} className="hover:bg-slate-50/80">
                        <td className="sticky left-0 z-10 bg-white px-6 py-3 shadow-[1px_0_0_0_#f1f5f9]">
                          <span className="font-medium text-slate-900">{p.label}</span>
                          <span className="ml-2 text-xs text-slate-400 font-mono">({p.code})</span>
                        </td>
                        {roles.map((r) => {
                          const isSuper = r.code === "super_admin";
                          const isChecked = isSuper ? true : (draft[r.code] ?? []).includes(p.code);

                          return (
                            <td key={r.code} className="px-4 py-3 text-center">
                              {isSuper ? (
                                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-blue-700" title="Full access">
                                  <Lock className="h-3 w-3" />
                                </span>
                              ) : (
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    setDraft((prev) => {
                                      const cur = prev[r.code] ?? [];
                                      const next = cur.includes(p.code)
                                        ? cur.filter((c) => c !== p.code)
                                        : [...cur, p.code];
                                      return { ...prev, [r.code]: next };
                                    });
                                  }}
                                  className="h-4 w-4 rounded border-slate-300 text-primary accent-primary focus:ring-primary"
                                />
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: CREATE NEW ROLE */}
      {isCreateRoleOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setIsCreateRoleOpen(false)}
            aria-hidden
          />
          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Create New Role</h3>
                  <p className="text-xs text-slate-500">Add a custom role and define its access</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateRoleOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateRole} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Role Display Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Exam Coordinator"
                  value={newRole.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    const code = name.toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_");
                    setNewRole((p) => ({ ...p, name, code: p.code ? p.code : code }));
                  }}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Role Code / Identifier <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. exam_coordinator"
                  value={newRole.code}
                  onChange={(e) =>
                    setNewRole((p) => ({
                      ...p,
                      code: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
                    }))
                  }
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
                />
                <p className="mt-1 text-[11px] text-slate-400">Unique identifier, lowercase and underscores only.</p>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Optional brief description of this role's responsibilities"
                  value={newRole.description}
                  onChange={(e) => setNewRole((p) => ({ ...p, description: e.target.value }))}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Clone Initial Permissions From
                </label>
                <select
                  value={newRole.cloneFrom}
                  onChange={(e) => setNewRole((p) => ({ ...p, cloneFrom: e.target.value }))}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
                >
                  <option value="">— Start with No Permissions —</option>
                  {roles
                    .filter((r) => r.code !== "super_admin")
                    .map((r) => (
                      <option key={r.code} value={r.code}>
                        {r.name} ({(matrix[r.code] ?? []).length} permissions)
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <Button variant="secondary" onClick={() => setIsCreateRoleOpen(false)} disabled={creatingRole}>
                  Cancel
                </Button>
                <Button type="submit" loading={creatingRole}>
                  Create Role
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE ROLE DIALOG */}
      <ConfirmDialog
        open={Boolean(deletingRole)}
        title="Delete Custom Role"
        message={`Are you sure you want to delete the "${deletingRole?.name}" role? Users assigned to this role will lose their permissions.`}
        confirmLabel="Delete Role"
        danger
        onConfirm={handleDeleteRole}
        onCancel={() => setDeletingRole(null)}
      />
    </div>
  );
}
