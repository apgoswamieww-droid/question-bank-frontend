import { Navigate, Route, Routes } from "react-router-dom";
import { AdminAuthProvider } from "../context/AdminAuthContext";
import { useAdminAuth } from "../context/useAdminAuth";
import AdminLoginPage from "./AdminLoginPage";
import AdminDashboardPage from "./AdminDashboardPage";
import { UsersPage } from "./UsersPage";
import { RolesPermissionsPage } from "./RolesPermissionsPage";
import QuestionBanksPage from "./QuestionBanksPage";
import QuestionEntryPage from "./QuestionEntryPage";
import QuestionAnalyticsPage from "./QuestionAnalyticsPage";
import TestsListPage from "./TestsListPage";
import TestCreatePage from "./TestCreatePage";
import TeacherEditorPage from "./TeacherEditorPage";
import StandardsPage from "./StandardsPage";
import SubjectsPage from "./SubjectsPage";
import ChaptersPage from "./ChaptersPage";
import TopicsPage from "./TopicsPage";
import ExamTypesPage from "./ExamTypesPage";
import LanguagesPage from "./LanguagesPage";
import SchoolsPage from "./SchoolsPage";
import EditorPage from "./EditorPage";
import TeacherCreatePage from "./TeacherCreatePage";
import TeacherEditPage from "./TeacherEditPage";
import ProfilePage from "./ProfilePage";
import ResetPasswordPage from "./ResetPasswordPage";
import ForgotPasswordPage from "./ForgotPasswordPage";
import { AdminLayout } from "./AdminLayout";
import ProtectedRoute from "./ProtectedRoute";
import type { ReactNode } from "react";

function RequireSuperAdmin({ children }: { children: ReactNode }) {
  const { user } = useAdminAuth();
  if (user?.role !== "super_admin") {
    return <Navigate to="/admin/dashboard" replace />;
  }
  return <>{children}</>;
}

export default function AdminRoutes() {
  return (
    <AdminAuthProvider>
      <Routes>
        <Route path="" element={<AdminLoginPage />} />
        <Route path="forgot-password" element={<ForgotPasswordPage />} />
        <Route path="reset-password" element={<ResetPasswordPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AdminLayout />}>
            <Route path="dashboard" element={<AdminDashboardPage />} />
            <Route path="teachers" element={<UsersPage role="teacher" />} />
            <Route path="students" element={<UsersPage role="student" />} />

            <Route path="question-banks" element={<QuestionBanksPage />} />
            <Route
              path="question-entry"
              element={
                <RequireSuperAdmin>
                  <QuestionEntryPage />
                </RequireSuperAdmin>
              }
            />
            <Route
              path="analytics"
              element={
                <RequireSuperAdmin>
                  <QuestionAnalyticsPage />
                </RequireSuperAdmin>
              }
            />
            <Route path="tests" element={<TestsListPage />} />
            <Route
              path="tests/new"
              element={
                <RequireSuperAdmin>
                  <TestCreatePage />
                </RequireSuperAdmin>
              }
            />
            <Route
              path="tests/:id/edit"
              element={
                <RequireSuperAdmin>
                  <TestCreatePage />
                </RequireSuperAdmin>
              }
            />
            <Route path="standards" element={<StandardsPage />} />
            <Route path="subjects" element={<SubjectsPage />} />
            <Route path="chapters" element={<ChaptersPage />} />
            <Route path="topics" element={<TopicsPage />} />
            <Route path="exam-types" element={<ExamTypesPage />} />
            <Route path="languages" element={<LanguagesPage />} />
            <Route path="schools" element={<SchoolsPage />} />
            <Route path="roles" element={<RolesPermissionsPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="editor" element={<RequireSuperAdmin><EditorPage /></RequireSuperAdmin>} />
            <Route
              path="teachers/new"
              element={
                <RequireSuperAdmin>
                  <TeacherCreatePage />
                </RequireSuperAdmin>
              }
            />
            <Route
              path="teachers/:id/edit"
              element={
                <RequireSuperAdmin>
                  <TeacherEditPage />
                </RequireSuperAdmin>
              }
            />
            <Route
              path="teachers/:id/editor"
              element={
                <RequireSuperAdmin>
                  <TeacherEditorPage />
                </RequireSuperAdmin>
              }
            />
          </Route>
        </Route>
        <Route path="*" element={<AdminLoginPage />} />
      </Routes>
    </AdminAuthProvider>
  );
}

