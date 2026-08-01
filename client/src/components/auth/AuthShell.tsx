"use client";

import { Eye, EyeOff } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  ApiError,
  AuthRole,
  authApi,
  clearSession,
  saveSession,
} from "@/lib/auth";

type AuthMode = "login" | "register" | "forgot" | "reset";

type AuthShellProps = {
  mode: AuthMode;
  resetToken?: string;
};

type FormState = {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  token: string;
  role: AuthRole;
  phone: string;
  dateOfBirth: string;
  address: string;
};

type FieldKey = keyof FormState | "form";
type FieldErrors = Partial<Record<FieldKey, string>>;

type RoleConfig = {
  label: string;
  shortLabel: string;
  loginTitle: string;
  registerTitle: string;
  subtitle: string;
  badge: string;
  metric: string;
  responsibilities: string[];
};

const roleOrder: AuthRole[] = ["admin", "agent", "customer"];

const roleConfig: Record<AuthRole, RoleConfig> = {
  admin: {
    label: "Administrator",
    shortLabel: "Admin",
    loginTitle: "Admin access for operations control",
    registerTitle: "Create an administrator profile",
    subtitle: "Manage employees, customers, reports, and platform settings.",
    badge: "Reports",
    metric: "Full system visibility",
    responsibilities: ["Employee control", "Claim assignment", "Reports"],
  },
  agent: {
    label: "Insurance Agent",
    shortLabel: "Agent",
    loginTitle: "Agent workspace for policy work",
    registerTitle: "Create an insurance agent profile",
    subtitle: "Register customers, create policies, verify documents, and review claims.",
    badge: "Policies",
    metric: "Customer workflow access",
    responsibilities: ["Customer onboarding", "Policy creation", "Claim review"],
  },
  customer: {
    label: "Customer",
    shortLabel: "Customer",
    loginTitle: "Customer portal for policy tracking",
    registerTitle: "Create your customer account",
    subtitle: "View policies, pay premiums, upload documents, and submit claims.",
    badge: "Portal",
    metric: "Self-service access",
    responsibilities: ["Policy view", "Premium payment", "Claim tracking"],
  },
};

const modeCopy: Record<
  AuthMode,
  {
    eyebrow: string;
    title: string;
    subtitle: string;
    submit: string;
    loading: string;
  }
> = {
  login: {
    eyebrow: "Secure sign in",
    title: "",
    subtitle: "",
    submit: "Sign in",
    loading: "Checking account access...",
  },
  register: {
    eyebrow: "Role-based access",
    title: "",
    subtitle: "",
    submit: "Create account",
    loading: "Creating secure account...",
  },
  forgot: {
    eyebrow: "Password recovery",
    title: "Send a reset link",
    subtitle: "Enter the registered email address to receive a secure reset link.",
    submit: "Send reset link",
    loading: "Preparing reset email...",
  },
  reset: {
    eyebrow: "New password",
    title: "Reset your password",
    subtitle: "Enter the reset token and choose a stronger password for this account.",
    submit: "Update password",
    loading: "Updating password...",
  },
};

const initialForm = (resetToken = ""): FormState => ({
  fullName: "",
  email: "",
  password: "",
  confirmPassword: "",
  token: resetToken,
  role: "customer",
  phone: "",
  dateOfBirth: "",
  address: "",
});

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const namePattern = /^[A-Za-z][A-Za-z .'-]{1,79}$/;
const phonePattern = /^[0-9+\-\s()]{7,20}$/;
const fieldKeys = new Set<FieldKey>([
  "fullName",
  "email",
  "password",
  "confirmPassword",
  "token",
  "role",
  "phone",
  "dateOfBirth",
  "address",
  "form",
]);

const getPasswordIssues = (password: string) => {
  const issues: string[] = [];

  if (password.length < 8) issues.push("at least 8 characters");
  if (password.length > 72) issues.push("72 characters or fewer");
  if (!/[A-Z]/.test(password)) issues.push("one uppercase letter");
  if (!/[a-z]/.test(password)) issues.push("one lowercase letter");
  if (!/[0-9]/.test(password)) issues.push("one number");
  if (!/[^A-Za-z0-9]/.test(password)) issues.push("one special character");

  return issues;
};

const validateAuthForm = (form: FormState, mode: AuthMode): FieldErrors => {
  const errors: FieldErrors = {};
  const trimmedEmail = form.email.trim();
  const requiresEmail = mode === "login" || mode === "register" || mode === "forgot";
  const requiresPassword =
    mode === "login" || mode === "register" || mode === "reset";

  if (mode === "register") {
    if (!form.fullName.trim()) {
      errors.fullName = "Full name is required.";
    } else if (!namePattern.test(form.fullName.trim())) {
      errors.fullName = "Use 2-80 letters, spaces, apostrophes, periods, or hyphens.";
    }

    if (form.role === "customer") {
      if (!form.phone.trim()) {
        errors.phone = "Phone number is required for customer accounts.";
      } else if (!phonePattern.test(form.phone.trim())) {
        errors.phone = "Use 7-20 digits, spaces, +, -, or parentheses.";
      }

      if (!form.dateOfBirth) {
        errors.dateOfBirth = "Date of birth is required for customer accounts.";
      } else {
        const dateOfBirth = new Date(`${form.dateOfBirth}T00:00:00`);

        if (
          Number.isNaN(dateOfBirth.getTime()) ||
          dateOfBirth.getTime() > Date.now()
        ) {
          errors.dateOfBirth = "Choose a valid date that is not in the future.";
        }
      }

      if (!form.address.trim()) {
        errors.address = "Address is required for customer accounts.";
      } else if (form.address.trim().length < 5) {
        errors.address = "Address must be at least 5 characters.";
      }
    }
  }

  if (requiresEmail && !emailPattern.test(trimmedEmail)) {
    errors.email = "Enter a valid email address.";
  }

  if (mode === "reset" && form.token.trim().length < 20) {
    errors.token = "Reset token is missing or incomplete.";
  }

  if (requiresPassword && !form.password) {
    errors.password = "Password is required.";
  }

  if ((mode === "register" || mode === "reset") && form.password) {
    const passwordIssues = getPasswordIssues(form.password);

    if (passwordIssues.length > 0) {
      errors.password = `Password needs ${passwordIssues.join(", ")}.`;
    }

    if (!form.confirmPassword) {
      errors.confirmPassword = "Confirm your password.";
    } else if (form.password !== form.confirmPassword) {
      errors.confirmPassword = "Passwords do not match.";
    }
  }

  return errors;
};

const mapApiErrors = (
  details?: Array<{ field: string; message: string }>
): FieldErrors => {
  if (!details?.length) {
    return {};
  }

  return details.reduce<FieldErrors>((nextErrors, detail) => {
    const field = detail.field as FieldKey;

    if (fieldKeys.has(field)) {
      nextErrors[field] = detail.message;
    } else {
      nextErrors.form = detail.message;
    }

    return nextErrors;
  }, {});
};

const getFirstError = (errors: FieldErrors) =>
  Object.values(errors).find(Boolean) || "Please check the submitted fields.";

export default function AuthShell({ mode, resetToken = "" }: AuthShellProps) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => initialForm(resetToken));
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const selectedRole = roleConfig[form.role];
  const copy = modeCopy[mode];
  const isLogin = mode === "login";
  const isRegister = mode === "register";
  const isForgot = mode === "forgot";
  const isReset = mode === "reset";
  const showsRoleSelector = isLogin || isRegister;

  const pageTitle = isLogin
    ? selectedRole.loginTitle
    : isRegister
      ? selectedRole.registerTitle
      : copy.title;
  const pageSubtitle = isLogin || isRegister ? selectedRole.subtitle : copy.subtitle;

  const passwordScore = useMemo(() => {
    let score = 0;

    if (form.password.length >= 8) score += 1;
    if (/[A-Z]/.test(form.password)) score += 1;
    if (/[a-z]/.test(form.password)) score += 1;
    if (/[0-9]/.test(form.password)) score += 1;
    if (/[^A-Za-z0-9]/.test(form.password)) score += 1;

    return score;
  }, [form.password]);

  const updateField =
    (field: keyof FormState) => (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;

      setForm((current) => ({
        ...current,
        [field]: value,
      }));

      setFieldErrors((current) => {
        if (!current[field]) {
          return current;
        }

        const next = { ...current };
        delete next[field];
        return next;
      });
    };

  const updateRole = (role: AuthRole) => {
    setForm((current) => ({ ...current, role }));
    setFieldErrors({});
  };

  const fieldClass = (field: keyof FormState) =>
    `h-11 w-full rounded-md border bg-white px-3 text-sm text-[#15222f] outline-none transition placeholder:text-[#8ca0af] ${
      fieldErrors[field]
        ? "border-[#d65c3a] focus:border-[#d65c3a] focus:ring-4 focus:ring-[#ffd6cc]"
        : "border-[#cfdbe5] focus:border-[#0f766e] focus:ring-4 focus:ring-[#a7f3d0]/45"
    }`;

  const roleHint = isRegister
    ? `You are creating a ${selectedRole.label.toLowerCase()} account.`
    : `Sign in as a ${selectedRole.shortLabel.toLowerCase()} user.`;

  const fieldMessage = (field: keyof FormState) =>
    fieldErrors[field] ? (
      <p className="mt-1 text-xs font-semibold text-[#b23b21]">
        {fieldErrors[field]}
      </p>
    ) : null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFieldErrors({});

    const validationErrors = validateAuthForm(form, mode);

    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      return;
    }

    const toastId = toast.loading(copy.loading);
    setIsLoading(true);

    try {
      if (isLogin) {
        const response = await authApi.login({
          email: form.email.trim(),
          password: form.password,
          role: form.role,
        });

        if (response.data) {
          saveSession(response.data);
          toast.success(`Welcome to the ${selectedRole.label.toLowerCase()} workspace.`, {
            id: toastId,
          });
          router.push("/dashboard");
        }
      }

      if (isRegister) {
        const response = await authApi.register({
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          password: form.password,
          role: form.role,
          phone: form.phone.trim(),
          dateOfBirth: form.dateOfBirth,
          address: form.address.trim(),
        });

        if (response.data) {
          saveSession(response.data);
          toast.success(`${selectedRole.label} account created successfully.`, {
            id: toastId,
          });
          router.push("/login");
        }
      }

      if (isForgot) {
        const response = await authApi.forgotPassword({
          email: form.email.trim(),
        });

        toast.success(
          response.message ||
            "If the account exists, a secure reset link will arrive shortly.",
          { id: toastId }
        );
      }

      if (isReset) {
        await authApi.resetPassword({
          token: form.token.trim(),
          password: form.password,
        });

        clearSession();
        toast.success("Password updated. Please log in with the new password.", {
          id: toastId,
        });
        router.push("/login");
      }
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "Something went wrong. Please try again.";

      if (caughtError instanceof ApiError) {
        setFieldErrors(mapApiErrors(caughtError.details));
      }
      toast.error(message, { id: toastId });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#eef3f6] text-[#15222f]">
      <div className="grid min-h-screen lg:grid-cols-[minmax(0,0.88fr)_minmax(480px,1.12fr)]">
        <aside className="relative hidden overflow-hidden bg-[#11353f] px-10 py-9 text-white lg:block">
          <div className="absolute inset-x-0 top-0 h-1 bg-[#e7aa45]" />
          <div className="mx-auto flex h-full max-w-155 flex-col justify-between gap-8">
            <div className="flex items-center justify-between">
              <Link href="/login" className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-md bg-[#0f766e] text-sm font-black">
                  IM
                </span>
                <span className="text-sm font-bold tracking-wide">
                  Insurance Management
                </span>
              </Link>
              <span className="rounded-md border border-white/15 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-[#bfe7dd]">
                Day 2
              </span>
            </div>

            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#e7aa45]">
                {selectedRole.label}
              </p>
              <h2 className="mt-4 max-w-130 text-5xl font-black leading-[1.02]">
                Secure access for insurance operations.
              </h2>
              <p className="mt-5 max-w-125 text-base leading-7 text-[#c7d9df]">
                Role-based authentication for admins, agents, and customers with
                JWT sessions, password reset email, and validated account data.
              </p>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/6 p-5">
              <div className="grid grid-cols-3 gap-3">
                {selectedRole.responsibilities.map((item) => (
                  <div
                    key={item}
                    className="min-h-24 rounded-md border border-white/10 bg-white/[0.07] p-3"
                  >
                    <p className="text-xs font-bold uppercase tracking-[0.13em] text-[#bfe7dd]">
                      Access
                    </p>
                    <p className="mt-3 text-sm font-bold leading-5">{item}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between rounded-md bg-[#09252d] px-4 py-3">
                <span className="text-sm text-[#c7d9df]">Current portal</span>
                <span className="text-sm font-bold text-white">
                  {selectedRole.metric}
                </span>
              </div>
            </div>

            <Image
              src="/auth-insurance.svg"
              alt="Insurance policy security dashboard"
              width={560}
              height={390}
              priority
              className="mx-auto h-auto w-full max-w-130"
            />
          </div>
        </aside>

        <section className="flex items-center justify-center px-4 py-6 sm:px-6 lg:px-10">
          <div className="w-full max-w-140 rounded-lg border border-[#d7e1ea] bg-white p-5 shadow-[0_24px_70px_rgba(21,34,47,0.12)] sm:p-7">
            <div className="mb-6 flex items-center justify-between gap-4 lg:hidden">
              <Link
                href="/login"
                className="flex items-center gap-3 text-sm font-bold text-[#17313d]"
              >
                <span className="grid h-10 w-10 place-items-center rounded-md bg-[#0f766e] text-sm text-white">
                  IM
                </span>
                <span>Insurance Management</span>
              </Link>
              <span className="rounded-md border border-[#d8e2ea] px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-[#6a7f90]">
                Auth
              </span>
            </div>

            <div className="mb-6">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#bd6230]">
                {copy.eyebrow}
              </p>
              <h1 className="mt-3 text-3xl font-black leading-tight text-[#102a43] sm:text-4xl">
                {pageTitle}
              </h1>
              <p className="mt-3 text-sm leading-6 text-[#5e7180]">
                {pageSubtitle}
              </p>
            </div>

            {(isLogin || isRegister) && (
              <div className="mb-5 grid grid-cols-2 rounded-lg bg-[#edf3f5] p-1 text-sm font-bold">
                <Link
                  href="/login"
                  className={`rounded-md px-4 py-2.5 text-center transition ${
                    isLogin
                      ? "bg-white text-[#0f766e] shadow-sm"
                      : "text-[#667987] hover:text-[#17313d]"
                  }`}
                >
                  Login
                </Link>
                <Link
                  href="/register"
                  className={`rounded-md px-4 py-2.5 text-center transition ${
                    isRegister
                      ? "bg-white text-[#0f766e] shadow-sm"
                      : "text-[#667987] hover:text-[#17313d]"
                  }`}
                >
                  Register
                </Link>
              </div>
            )}

            {showsRoleSelector && (
              <>
                <div className="mb-3 rounded-md border border-[#dfe7ef] bg-[#f8fafc] px-3 py-2 text-sm font-semibold text-[#5e7180]">
                  {roleHint}
                </div>

                <div className="mb-5 grid gap-2 rounded-lg border border-[#dfe7ef] bg-[#f8fafc] p-2 sm:grid-cols-3">
                  {roleOrder.map((role) => {
                    const config = roleConfig[role];
                    const isSelected = form.role === role;

                    return (
                      <button
                        key={role}
                        className={`min-h-20.5 rounded-md border px-3 py-3 text-left transition ${
                          isSelected
                            ? "border-[#12333d] bg-[#12333d] text-white shadow-sm"
                            : "border-[#dfe7ef] bg-white text-[#546879] hover:border-[#0f766e] hover:text-[#12333d]"
                        }`}
                        onClick={() => updateRole(role)}
                        type="button"
                      >
                        <span className="block text-sm font-black">
                          {config.shortLabel}
                        </span>
                        <span
                          className={`mt-2 block text-[0.68rem] font-bold uppercase tracking-[0.12em] ${
                            isSelected ? "text-[#b7e5dc]" : "text-[#8a9aaa]"
                          }`}
                        >
                          {config.badge}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            <form className="space-y-4" noValidate onSubmit={handleSubmit}>
              {isRegister && (
                <label className="block">
                  <span className="mb-1.5 block text-sm font-bold text-[#263f4d]">
                    Full name
                  </span>
                  <input
                    autoComplete="name"
                    className={fieldClass("fullName")}
                    onChange={updateField("fullName")}
                    placeholder="Aarav Mehta"
                    value={form.fullName}
                  />
                  {fieldMessage("fullName")}
                </label>
              )}

              {(isLogin || isRegister || isForgot) && (
                <label className="block">
                  <span className="mb-1.5 block text-sm font-bold text-[#263f4d]">
                    Email address
                  </span>
                  <input
                    autoComplete="email"
                    className={fieldClass("email")}
                    onChange={updateField("email")}
                    placeholder="you@company.com"
                    type="email"
                    value={form.email}
                  />
                  {fieldMessage("email")}
                </label>
              )}

              {isRegister && form.role === "customer" && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-bold text-[#263f4d]">
                      Phone
                    </span>
                    <input
                      autoComplete="tel"
                      className={fieldClass("phone")}
                      onChange={updateField("phone")}
                      placeholder="+91 98765 43210"
                      value={form.phone}
                    />
                    {fieldMessage("phone")}
                  </label>

                  <label className="block">
                    <span className="mb-1.5 block text-sm font-bold text-[#263f4d]">
                      Date of birth
                    </span>
                    <input
                      className={fieldClass("dateOfBirth")}
                      onChange={updateField("dateOfBirth")}
                      type="date"
                      value={form.dateOfBirth}
                    />
                    {fieldMessage("dateOfBirth")}
                  </label>

                  <label className="block sm:col-span-2">
                    <span className="mb-1.5 block text-sm font-bold text-[#263f4d]">
                      Address
                    </span>
                    <input
                      autoComplete="street-address"
                      className={fieldClass("address")}
                      onChange={updateField("address")}
                      placeholder="House, street, city"
                      value={form.address}
                    />
                    {fieldMessage("address")}
                  </label>
                </div>
              )}

              {isReset && (
                <label className="block">
                  <span className="mb-1.5 block text-sm font-bold text-[#263f4d]">
                    Reset token
                  </span>
                  <input
                    className={fieldClass("token")}
                    onChange={updateField("token")}
                    placeholder="Token from your reset email"
                    value={form.token}
                  />
                  {fieldMessage("token")}
                </label>
              )}

              {(isLogin || isRegister || isReset) && (
                <label className="block">
                  <span className="mb-1.5 block text-sm font-bold text-[#263f4d]">
                    Password
                  </span>
                  <div className="relative">
                    <input
                      autoComplete={isLogin ? "current-password" : "new-password"}
                      className={`${fieldClass("password")} pr-10`}
                      onChange={updateField("password")}
                      placeholder="Enter your password"
                      type={showPassword ? "text" : "password"}
                      value={form.password}
                    />
                    <button
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute inset-y-0 right-3 flex items-center text-[#6a7f90] transition hover:text-[#15222f]"
                      onClick={() => setShowPassword((current) => !current)}
                      type="button"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {fieldMessage("password")}
                </label>
              )}

              {(isRegister || isReset) && (
                <div className="space-y-3">
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-bold text-[#263f4d]">
                      Confirm password
                    </span>
                    <div className="relative">
                      <input
                        autoComplete="new-password"
                        className={`${fieldClass("confirmPassword")} pr-10`}
                        onChange={updateField("confirmPassword")}
                        placeholder="Repeat your password"
                        type={showConfirmPassword ? "text" : "password"}
                        value={form.confirmPassword}
                      />
                      <button
                        aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                        className="absolute inset-y-0 right-3 flex items-center text-[#6a7f90] transition hover:text-[#15222f]"
                        onClick={() => setShowConfirmPassword((current) => !current)}
                        type="button"
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    {fieldMessage("confirmPassword")}
                  </label>

                  <div>
                    <div className="grid grid-cols-5 gap-1.5" aria-hidden="true">
                      {[0, 1, 2, 3, 4].map((step) => (
                        <span
                          key={step}
                          className={`h-1.5 rounded-sm ${
                            passwordScore > step ? "bg-[#0f766e]" : "bg-[#dce5eb]"
                          }`}
                        />
                      ))}
                    </div>
                    <p className="mt-2 text-xs leading-5 text-[#6a7f90]">
                      At least 8 characters with uppercase, lowercase, number,
                      and special character.
                    </p>
                  </div>
                </div>
              )}

              {isLogin && (
                <div className="flex justify-end">
                  <Link
                    className="text-sm font-black text-[#0f766e] hover:text-[#0b5f59]"
                    href="/forgot-password"
                  >
                    Forgot password?
                  </Link>
                </div>
              )}

              <button
                className="h-11 w-full rounded-md bg-[#0f766e] px-5 text-sm font-black text-white shadow-[0_14px_30px_rgba(15,118,110,0.22)] transition hover:bg-[#0b5f59] disabled:cursor-not-allowed disabled:bg-[#8bbab5]"
                disabled={isLoading}
                type="submit"
              >
                {isLoading ? "Please wait..." : copy.submit}
              </button>
            </form>

            <div className="mt-6 border-t border-[#edf1f5] pt-5 text-center text-sm text-[#667987]">
              {isLogin && (
                <p>
                  New to the platform?{" "}
                  <Link
                    className="font-black text-[#0f766e] hover:text-[#0b5f59]"
                    href="/register"
                  >
                    Create an account
                  </Link>
                </p>
              )}
              {isRegister && (
                <p>
                  Already have access?{" "}
                  <Link
                    className="font-black text-[#0f766e] hover:text-[#0b5f59]"
                    href="/login"
                  >
                    Sign in
                  </Link>
                </p>
              )}
              {(isForgot || isReset) && (
                <p>
                  Remembered your password?{" "}
                  <Link
                    className="font-black text-[#0f766e] hover:text-[#0b5f59]"
                    href="/login"
                  >
                    Back to login
                  </Link>
                </p>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
