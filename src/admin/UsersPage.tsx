import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, Pencil, Plus, Trash2, Users as UsersIcon, ShieldCheck, CheckCircle2 } from "lucide-react";
import { api, ApiError, type AdminUser, type UserRole } from "../api/client";
import { useAdminAuth } from "../context/useAdminAuth";
import { PageHeader } from "./components/PageHeader";
import { Button } from "./components/Button";
import { DataTable, type DataTableColumn } from "./components/DataTable";
import { UserFormModal } from "./components/UserFormModal";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { ROLE_META } from "./components/roleMeta";
import { TableSkeleton } from "./components/Skeleton";

const TITLE_BY_ROLE: Record<UserRole, string> = {
  super_admin: "Super Admins",
  teacher: "Teachers",
  student: "Students",
};

export function UsersPage({ role }: { role: UserRole }) {
  const { user: currentUser } = useAdminAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [confirming, setConfirming] = useState<{
    user: AdminUser;
    action: "deactivate" | "reactivate" | "delete";
  } | null>(null);
  const [sendingReset, setSendingReset] = useState<AdminUser | null>(null);
  const [resetSent, setResetSent] = useState<string | null>(null); // teacher name
  const [togglingActive, setTogglingActive] = useState<string | null>(null); // user id being toggled

  const isSuperAdmin = currentUser?.role === "super_admin";
  const canCrud = isSuperAdmin;

  const load = useCallback(async () => {
    try {
      const res = await api.admin.listUsers();
      setUsers(res.users);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load users.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    api.admin
      .listUsers()
      .then((res) => {
        if (active) setUsers(res.users);
      })
      .catch((err) => {
        if (active) setError(err instanceof ApiError ? err.message : "Failed to load users.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const filtered = users.filter((u) => u.role === role);
  const meta = ROLE_META[role];

  const handleSubmit = async (data: {
    email: string;
    name: string;
    password: string;
    role: UserRole;
    active: boolean;
    phone: string;
    gender: string;
    dateOfBirth: string;
    address: string;
    hireDate: string;
    subject: string;
    qualification: string;
  }) => {
    if (editing) {
      await api.admin.updateUser(editing.id, {
        name: data.name,
        email: data.email,
        password: data.password || undefined,
        active: data.active,
        phone: data.phone || undefined,
        gender: data.gender || undefined,
        dateOfBirth: data.dateOfBirth || undefined,
        address: data.address || undefined,
        hireDate: data.hireDate || undefined,
        subject: data.subject || undefined,
        qualification: data.qualification || undefined,
      });
    } else {
      await api.admin.createUser(data);
    }
    await load();
  };

  const handleToggleActive = async (user: AdminUser) => {
    if (!canCrud || user.id === currentUser?.id) return;

    setTogglingActive(user.id);
    try {
      await api.admin.updateUser(user.id, { active: !user.active });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update status.");
    } finally {
      setTogglingActive(null);
    }
  };

  const handleSendResetLink = async () => {
    if (!sendingReset) return;
    try {
      await api.forgotPassword(sendingReset.email);
      setResetSent(sendingReset.name);
      window.setTimeout(() => setResetSent(null), 4000);
    } catch {
      // Silently handle — server always returns success to prevent enumeration
      setResetSent(sendingReset.name);
      window.setTimeout(() => setResetSent(null), 4000);
    } finally {
      setSendingReset(null);
    }
  };

  const handleConfirm = async () => {
    if (!confirming) return;
    const { user, action } = confirming;
    try {
      if (action === "delete") {
        await api.admin.deleteUser(user.id);
      } else {
        await api.admin.updateUser(user.id, { active: action === "reactivate" });
      }
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Operation failed.");
    } finally {
      setConfirming(null);
    }
  };

  const columns: DataTableColumn<AdminUser>[] = [
    {
      key: "name",
      header: "User",
      sortValue: (u) => u.name ?? "",
      render: (u) => (
        <div className="flex items-center gap-3">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${meta.chip}`}>
            {u.name?.slice(0, 1)?.toUpperCase() ?? "?"}
          </div>
          <div>
            <p className="font-medium text-slate-900">{u.name}</p>
            <p className="text-xs text-slate-500">{u.email}</p>
          </div>
        </div>
      ),
    },
    { key: "email", header: "Email", sortValue: (u) => u.email, render: (u) => <span className="text-sm text-slate-600">{u.email}</span> },
    ...(role === "teacher"
      ? ([
          { key: "subject", header: "Subject", sortValue: (u: AdminUser) => u.subject ?? "", render: (u: AdminUser) => <span className="text-sm text-slate-600">{u.subject || "—"}</span> },
          { key: "phone", header: "Phone", sortValue: (u: AdminUser) => u.phone ?? "", render: (u: AdminUser) => <span className="text-sm text-slate-600">{u.phone || "—"}</span> },
        ] as DataTableColumn<AdminUser>[])
      : []),
    {
      key: "active",
      header: "Status",
      sortValue: (u) => (u.active ? "active" : "inactive"),
      render: (u) => (
        <button
          type="button"
          disabled={!canCrud || u.id === currentUser?.id || togglingActive === u.id}
          onClick={() => handleToggleActive(u)}
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 transition-all ${
            u.active ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-slate-100 text-slate-500 ring-slate-200"
          } ${
            canCrud && u.id !== currentUser?.id
              ? "hover:opacity-80 cursor-pointer"
              : "cursor-default"
          } ${
            togglingActive === u.id ? "opacity-50" : ""
          }`}
          title={canCrud && u.id !== currentUser?.id ? `Click to ${u.active ? "deactivate" : "activate"}` : undefined}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${u.active ? "bg-emerald-500" : "bg-slate-400"}`} />
          {u.active ? "Active" : "Inactive"}
        </button>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      headerClassName: "w-px text-right",
      render: (u) => (
        <div className="flex justify-end gap-0.5">
          {role === "teacher" && canCrud && (
            <button
              type="button"
              onClick={() => setSendingReset(u)}
              aria-label={`Send reset link to ${u.name}`}
              title="Send password reset link"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-blue-600"
            >
              <Mail className="h-4 w-4" aria-hidden />
            </button>
          )}
          {canCrud && (
            <button
              type="button"
              onClick={() =>
                role === "teacher"
                  ? navigate(`/admin/teachers/${u.id}/edit`)
                  : (setEditing(u), setModalOpen(true))
              }
              aria-label={`Edit ${u.name}`}
              title="Edit"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-primary"
            >
              <Pencil className="h-4 w-4" aria-hidden />
            </button>
          )}
          {canCrud && u.id !== currentUser?.id && (
            <>
              <button
                type="button"
                onClick={() => setConfirming({ user: u, action: u.active ? "deactivate" : "reactivate" })}
                title={u.active ? "Deactivate" : "Reactivate"}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-amber-600"
              >
                <ShieldCheck className="h-4 w-4" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => setConfirming({ user: u, action: "delete" })}
                title="Delete"
                aria-label={`Delete ${u.name}`}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  const confirmMeta =
    confirming?.action === "delete"
      ? {
          title: "Delete user",
          message: `This permanently deletes ${confirming.user.name}. This cannot be undone.`,
          confirmLabel: "Delete",
          danger: true,
        }
      : confirming?.action === "deactivate"
        ? { title: "Deactivate account", message: `Deactivate ${confirming.user.name}? They will no longer be able to sign in.`, confirmLabel: "Deactivate", danger: true }
        : confirming
          ? { title: "Reactivate account", message: `Reactivate ${confirming.user.name}?`, confirmLabel: "Reactivate", danger: false }
          : { title: "", message: "", confirmLabel: "", danger: false };

  return (
    <div className="space-y-6">
      <PageHeader
        title={TITLE_BY_ROLE[role]}
        subtitle={`Manage ${meta.label.toLowerCase()} accounts`}
        actions={
          canCrud ? (
            <Button onClick={() => (role === "teacher" ? navigate("/admin/teachers/new") : (setEditing(null), setModalOpen(true)))}>
              <Plus className="h-4 w-4" aria-hidden /> Register {TITLE_BY_ROLE[role].toLowerCase().replace(/s$/, "")}
            </Button>
          ) : undefined
        }
      />

      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {loading ? (
        <TableSkeleton rows={5} cols={role === "teacher" ? 6 : 4} />
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          rowKey={(u) => u.id}
          searchPlaceholder={`Search ${TITLE_BY_ROLE[role].toLowerCase()}…`}
          emptyIcon={<UsersIcon className="h-6 w-6" aria-hidden />}
          emptyTitle={`No ${TITLE_BY_ROLE[role].toLowerCase()} listed`}
          emptyDescription="Register an account to get started."
          emptyAction={
            canCrud ? (
              <Button onClick={() => { setEditing(null); setModalOpen(true); }}>
                <Plus className="h-4 w-4" aria-hidden /> Register {TITLE_BY_ROLE[role].toLowerCase().replace(/s$/, "")}
              </Button>
            ) : undefined
          }
          initialSortedColumn="name"
        />
      )}

      <UserFormModal
        open={modalOpen}
        mode={editing ? "edit" : "create"}
        initial={editing}
        roleDefault={role}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        onSubmit={handleSubmit}
      />

      {/* Reset link sent toast */}
      <div
        role="status"
        aria-live="polite"
        className={`fixed bottom-6 right-6 z-50 transition-all duration-200 ${
          resetSent ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"
        }`}
      >
        {resetSent && (
          <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-white px-4 py-3 shadow-lg">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
            <span className="text-sm font-medium text-slate-900">
              Reset link sent to <strong>{resetSent}</strong>
            </span>
          </div>
        )}
      </div>

      {/* Send reset link confirmation */}
      <ConfirmDialog
        open={Boolean(sendingReset)}
        title="Send password reset link"
        message={`Send a password reset link to ${sendingReset?.name} (${sendingReset?.email})? They will receive an email with a secure link to set a new password.`}
        confirmLabel="Send Reset Link"
        danger={false}
        onConfirm={handleSendResetLink}
        onCancel={() => setSendingReset(null)}
      />

      <ConfirmDialog
        open={Boolean(confirming)}
        title={confirmMeta.title}
        message={confirmMeta.message}
        confirmLabel={confirmMeta.confirmLabel}
        danger={confirmMeta.danger}
        onConfirm={handleConfirm}
        onCancel={() => setConfirming(null)}
      />
    </div>
  );
}
