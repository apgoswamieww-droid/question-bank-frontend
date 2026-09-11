import { useCallback, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  Camera,
  KeyRound,
  Mail,
  Save,
  User,
} from "lucide-react";
import { api, ApiError } from "../api/client";
import { useAdminAuth } from "../context/useAdminAuth";
import { Button } from "./components/Button";
import { ProfileSkeleton } from "./components/Skeleton";

function validateName(v: string) {
  if (!v.trim()) return "Name is required.";
  if (v.trim().length < 2) return "Name must be at least 2 characters.";
  if (v.trim().length > 120) return "Name is too long.";
  return undefined;
}

function validateEmail(v: string) {
  if (!v.trim()) return "Email is required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())) return "Enter a valid email address.";
  if (v.trim().length > 254) return "Email is too long.";
  return undefined;
}

function validateCurrentPassword(v: string) {
  if (!v) return "Current password is required.";
  return undefined;
}

function validateNewPassword(v: string) {
  if (!v) return "New password is required.";
  if (v.length < 8) return "Password must be at least 8 characters.";
  if (v.length > 256) return "Password is too long.";
  return undefined;
}

function validateConfirm(v: string, password: string) {
  if (!v) return "Please confirm your new password.";
  if (v !== password) return "Passwords do not match.";
  return undefined;
}

export default function ProfilePage() {
  const { user, isBootstrapping } = useAdminAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Profile fields
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [gender, setGender] = useState(user?.gender ?? "");
  const [dateOfBirth, setDateOfBirth] = useState(user?.dateOfBirth ?? "");
  const [address, setAddress] = useState(user?.address ?? "");
  const [profileImage, setProfileImage] = useState(user?.profileImage ?? "");

  // Password fields
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // UI state
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Live validation with touched tracking
  const [profileTouched, setProfileTouched] = useState<Record<string, boolean>>({});
  const [passwordTouched, setPasswordTouched] = useState<Record<string, boolean>>({});

  const touchProfile = useCallback((field: string) => setProfileTouched((t) => ({ ...t, [field]: true })), []);
  const touchPassword = useCallback((field: string) => setPasswordTouched((t) => ({ ...t, [field]: true })), []);

  // Profile live errors
  const pNameError = profileTouched.name ? validateName(name) : undefined;
  const pEmailError = profileTouched.email ? validateEmail(email) : undefined;

  // Password live errors
  const pwCurrentError = passwordTouched.current ? validateCurrentPassword(currentPassword) : undefined;
  const pwNewError = passwordTouched.newPw ? validateNewPassword(newPassword) : undefined;
  const pwConfirmError = passwordTouched.confirm ? validateConfirm(confirmPassword, newPassword) : undefined;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be less than 2MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setProfileImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleProfileSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setProfileTouched({ name: true, email: true });
    const nErr = validateName(name);
    const eErr = validateEmail(email);
    if (nErr || eErr) return;
    setSavingProfile(true);
    try {
      const res = await api.updateProfile({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        gender: gender.trim() || undefined,
        dateOfBirth: dateOfBirth || undefined,
        address: address.trim() || undefined,
        profileImage: profileImage || undefined,
      });
      const stored = localStorage.getItem("qb.admin.user");
      if (stored) {
        const parsed = JSON.parse(stored);
        localStorage.setItem("qb.admin.user", JSON.stringify({ ...parsed, ...res.user }));
      }
      toast.success("Profile updated successfully.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setPasswordTouched({ current: true, newPw: true, confirm: true });
    const cErr = validateCurrentPassword(currentPassword);
    const nErr = validateNewPassword(newPassword);
    const cfErr = validateConfirm(confirmPassword, newPassword);
    if (cErr || nErr || cfErr) return;
    setSavingPassword(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordTouched({});
      toast.success("Password changed successfully.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to change password.");
    } finally {
      setSavingPassword(false);
    }
  };

  const inputClass = (hasError?: boolean | string) =>
    `w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-black placeholder:text-slate-400 outline-none transition disabled:bg-slate-100 ${
      hasError
        ? "border-red-400 focus:border-red-500 focus:ring-4 focus:ring-red-100"
        : "border-slate-300 focus:border-primary focus:ring-4 focus:ring-primary/15"
    }`;
  const label = "mb-1 block text-sm font-medium text-slate-700";
  const errorText = "mt-1 text-xs font-medium text-red-600";

  if (isBootstrapping) {
    return <ProfileSkeleton />;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white">
          <User className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight text-slate-900">My Profile</h1>
          <p className="text-sm text-slate-600">Manage your account settings</p>
        </div>
      </div>

      {/* Profile Image & Info */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
          <h2 className="text-sm font-semibold text-slate-900">Profile Information</h2>
        </div>
        <div className="p-6">
          <div className="mb-6 flex items-center gap-5">
            <div className="relative">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 text-2xl font-bold text-slate-400 overflow-hidden">
                {profileImage ? (
                  <img src={profileImage} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  user?.name?.slice(0, 1)?.toUpperCase() ?? "U"
                )}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white shadow-lg transition hover:bg-primary-600"
                title="Change profile image"
              >
                <Camera className="h-4 w-4" aria-hidden />
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">{user?.name}</p>
              <p className="text-xs text-slate-500">{user?.role?.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}</p>
              {profileImage && (
                <button type="button" onClick={() => setProfileImage("")} className="mt-1 text-xs text-red-500 hover:text-red-700">
                  Remove image
                </button>
              )}
            </div>
          </div>

          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={label}>Full name *</label>
                <input
                  className={inputClass(pNameError)}
                  value={name}
                  onChange={(e) => { setName(e.target.value); if (profileTouched.name) touchProfile("name"); }}
                  onBlur={() => touchProfile("name")}
                  placeholder="Your full name"
                />
                {pNameError && <p className={errorText}>{pNameError}</p>}
              </div>
              <div className="sm:col-span-2">
                <label className={label}>
                  <Mail className="mr-1 inline h-3.5 w-3.5" aria-hidden /> Email *
                </label>
                <input
                  type="email"
                  className={inputClass(pEmailError)}
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); if (profileTouched.email) touchProfile("email"); }}
                  onBlur={() => touchProfile("email")}
                  placeholder="you@example.com"
                />
                {pEmailError && <p className={errorText}>{pEmailError}</p>}
              </div>
              <div>
                <label className={label}>Phone</label>
                <input className={inputClass()} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98765 43210" />
              </div>
              <div>
                <label className={label}>Gender</label>
                <select className={inputClass()} value={gender} onChange={(e) => setGender(e.target.value)}>
                  <option value="">—</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className={label}>Date of birth</label>
                <input type="date" className={inputClass()} value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label className={label}>Address</label>
                <input className={inputClass()} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="House, street, city" />
              </div>
            </div>

            <div className="flex justify-end border-t border-slate-100 pt-4">
              <Button type="submit" loading={savingProfile}>
                <Save className="h-4 w-4" aria-hidden /> Save Profile
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* Change Password */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
          <h2 className="text-sm font-semibold text-slate-900">
            <KeyRound className="mr-1.5 inline h-4 w-4 text-primary" aria-hidden />
            Change Password
          </h2>
        </div>
        <div className="p-6">
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label className={label}>Current password *</label>
              <input
                type="password"
                className={inputClass(pwCurrentError)}
                value={currentPassword}
                onChange={(e) => { setCurrentPassword(e.target.value); if (passwordTouched.current) touchPassword("current"); }}
                onBlur={() => touchPassword("current")}
                placeholder="••••••••"
                autoComplete="current-password"
              />
              {pwCurrentError && <p className={errorText}>{pwCurrentError}</p>}
            </div>
            <div>
              <label className={label}>New password *</label>
              <input
                type="password"
                className={inputClass(pwNewError)}
                value={newPassword}
                onChange={(e) => { setNewPassword(e.target.value); if (passwordTouched.newPw) touchPassword("newPw"); }}
                onBlur={() => touchPassword("newPw")}
                placeholder="8+ characters"
                autoComplete="new-password"
              />
              {pwNewError && <p className={errorText}>{pwNewError}</p>}
            </div>
            <div>
              <label className={label}>Confirm new password *</label>
              <input
                type="password"
                className={inputClass(pwConfirmError)}
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); if (passwordTouched.confirm) touchPassword("confirm"); }}
                onBlur={() => touchPassword("confirm")}
                placeholder="Repeat new password"
                autoComplete="new-password"
              />
              {pwConfirmError && <p className={errorText}>{pwConfirmError}</p>}
            </div>

            <div className="flex justify-end border-t border-slate-100 pt-4">
              <Button type="submit" loading={savingPassword}>
                <KeyRound className="h-4 w-4" aria-hidden /> Change Password
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
