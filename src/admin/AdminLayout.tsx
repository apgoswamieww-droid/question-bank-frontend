import { useState, useRef, useEffect } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {

  BarChart3,
  Building2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  FileText,
  GraduationCap,
  Globe,
  Hash,
  Layers,
  LayoutDashboard,
  Library,
  LogOut,
  Menu,
  BookMarked,
  Settings,
  ShieldCheck,
  User,
  Users,
  UserRound,
  PenLine,
  X,
  type LucideIcon,
} from "lucide-react";
import { Toaster } from "sonner";
import { useAdminAuth, useCan, PERMISSIONS } from "../context/useAdminAuth";
import { ROLE_META } from "./components/roleMeta";

// ---------------------------------------------------------------------------
// Navigation structure with sections
// ---------------------------------------------------------------------------
interface NavItem {
  label: string;
  icon: LucideIcon;
  to: string;
  perm: string | null;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: "Main",
    items: [
      { label: "Dashboard", icon: LayoutDashboard, to: "/admin/dashboard", perm: null },
    ],
  },
  {
    title: "Users",
    items: [
      { label: "Teachers", icon: UserRound, to: "/admin/teachers", perm: PERMISSIONS.USERS_VIEW },
      { label: "Students", icon: GraduationCap, to: "/admin/students", perm: PERMISSIONS.USERS_VIEW },

      { label: "Schools", icon: Building2, to: "/admin/schools", perm: PERMISSIONS.USERS_MANAGE },
    ],
  },
  {
    title: "Content",
    items: [
      { label: "Question Entry", icon: PenLine, to: "/admin/question-entry", perm: PERMISSIONS.QUESTION_BANKS_MANAGE },
      { label: "Tests", icon: ClipboardList, to: "/admin/tests", perm: PERMISSIONS.QUESTION_BANKS_MANAGE },
      { label: "Question Banks", icon: Library, to: "/admin/question-banks", perm: PERMISSIONS.QUESTION_BANKS_VIEW },
      { label: "Analytics", icon: BarChart3, to: "/admin/analytics", perm: PERMISSIONS.QUESTION_BANKS_VIEW },
    ],
  },
  {
    title: "Hierarchy",
    items: [
      { label: "Standards", icon: Hash, to: "/admin/standards", perm: PERMISSIONS.USERS_MANAGE },
      { label: "Subjects", icon: FileText, to: "/admin/subjects", perm: PERMISSIONS.USERS_MANAGE },
      { label: "Chapters", icon: BookMarked, to: "/admin/chapters", perm: PERMISSIONS.USERS_MANAGE },
      { label: "Topics", icon: Layers, to: "/admin/topics", perm: PERMISSIONS.USERS_MANAGE },
    ],
  },
  {
    title: "Settings",
    items: [
      { label: "Exam Types", icon: ClipboardList, to: "/admin/exam-types", perm: PERMISSIONS.USERS_MANAGE },
      { label: "Languages", icon: Globe, to: "/admin/languages", perm: PERMISSIONS.USERS_MANAGE },
      { label: "Roles & Permissions", icon: Settings, to: "/admin/roles", perm: PERMISSIONS.ROLES_MANAGE },
    ],
  },
];

// ---------------------------------------------------------------------------
// Sidebar component
// ---------------------------------------------------------------------------
function SidebarContent({
  user,
  badge,
  visibleSections,
  onNavigate,
}: {
  user: ReturnType<typeof useAdminAuth>["user"];
  badge: { label: string; chip: string };
  visibleSections: NavSection[];
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className="flex h-[4.5rem] shrink-0 items-center gap-3 border-b border-slate-100 px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary shadow-lg shadow-primary/30">
          <ShieldCheck className="h-5 w-5 text-white" aria-hidden />
        </div>
        <span className="truncate text-base font-bold tracking-tight text-slate-900">Question Bank</span>
      </div>

      {/* Scrollable nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 scrollbar-thin" aria-label="Admin navigation">
        {visibleSections.map((section) => (
          <div key={section.title} className="mb-3">
            <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              {section.title}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
                      isActive
                        ? "bg-primary text-white shadow-sm shadow-primary/25"
                        : "text-slate-600 hover:bg-primary-50 hover:text-primary"
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <item.icon
                        className={`h-[18px] w-[18px] shrink-0 transition-colors ${
                          isActive ? "text-white" : "text-slate-400 group-hover:text-primary"
                        }`}
                        aria-hidden
                      />
                      <span className="truncate">{item.label}</span>
                      {isActive && <ChevronRight className="ml-auto h-4 w-4 text-white/70" aria-hidden />}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* User profile (fixed at bottom) */}
      <div className="shrink-0 border-t border-slate-200 bg-white p-4">
        <div className="flex items-center gap-3">
          {user?.profileImage ? (
            <img
              src={user.profileImage}
              alt="Profile"
              className="h-9 w-9 shrink-0 rounded-full object-cover ring-2 ring-slate-200"
            />
          ) : (
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white uppercase ${badge.chip}`}>
              {user?.name?.slice(0, 1) ?? "A"}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900">{user?.name}</p>
            <p className="truncate text-xs text-slate-500">{badge.label}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main layout
// ---------------------------------------------------------------------------
export function AdminLayout() {
  const { user, logout } = useAdminAuth();
  const can = useCan();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const role = user?.role ?? "super_admin";
  const badge = ROLE_META[role];

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [dropdownOpen]);

  // Filter sections by permission
  const visibleSections = navSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !item.perm || can(item.perm)),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900 font-sans">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-200 bg-white lg:block">
        <SidebarContent user={user} badge={badge} visibleSections={visibleSections} />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
            onClick={() => setSidebarOpen(false)}
            aria-hidden
          />
          <aside className="absolute inset-y-0 left-0 w-72 border-r border-slate-200 bg-white shadow-2xl transition-transform">
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close menu"
              className="absolute right-3 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-900"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
            <SidebarContent
              user={user}
              badge={badge}
              visibleSections={visibleSections}
              onNavigate={() => setSidebarOpen(false)}
            />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Header */}
        <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100 lg:hidden"
          >
            <Menu className="h-5 w-5" aria-hidden />
          </button>
          <div className="min-w-0 flex-1">
            <span className="text-sm font-medium text-slate-500">Admin Panel</span>
          </div>

          {/* Profile dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setDropdownOpen((o) => !o)}
              className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {user?.profileImage ? (
                <img
                  src={user.profileImage}
                  alt="Profile"
                  className="h-8 w-8 rounded-full object-cover ring-2 ring-slate-200"
                />
              ) : (
                <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white ${badge.chip}`}>
                  {user?.name?.slice(0, 1)?.toUpperCase() ?? "A"}
                </div>
              )}
              <span className="hidden text-sm font-medium text-slate-700 sm:inline">{user?.name}</span>
              <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} aria-hidden />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1.5 shadow-xl">
                <div className="border-b border-slate-100 px-4 py-3">
                  <p className="truncate text-sm font-semibold text-slate-900">{user?.name}</p>
                  <p className="truncate text-xs text-slate-500">{user?.email}</p>
                </div>
                <button
                  type="button"
                  onClick={() => { setDropdownOpen(false); navigate("/admin/profile"); }}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50"
                >
                  <User className="h-4 w-4 text-slate-400" aria-hidden /> My Profile
                </button>
                <button
                  type="button"
                  onClick={() => { setDropdownOpen(false); navigate("/admin/profile"); }}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50"
                >
                  <Settings className="h-4 w-4 text-slate-400" aria-hidden /> Settings
                </button>
                <div className="my-1 border-t border-slate-100" />
                <button
                  type="button"
                  onClick={() => { setDropdownOpen(false); logout(); }}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 transition hover:bg-red-50"
                >
                  <LogOut className="h-4 w-4" aria-hidden /> Sign out
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
      <Toaster position="bottom-right" richColors closeButton />
    </div>
  );
}
