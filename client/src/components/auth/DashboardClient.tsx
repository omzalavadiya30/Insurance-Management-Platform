"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  AuthRole,
  AuthSession,
  authApi,
  clearSession,
  getStoredSession,
  saveSession,
} from "@/lib/auth";

const roleDashboard: Record<
  AuthRole,
  {
    label: string;
    metrics: Array<{ label: string; value: string; tone: string }>;
    tasks: string[];
  }
> = {
  admin: {
    label: "Administrator",
    metrics: [
      { label: "Active policies", value: "1,284", tone: "bg-[#e9f8f6]" },
      { label: "Premium collection", value: "Rs 42.8L", tone: "bg-[#fff4e1]" },
      { label: "Claim approvals", value: "76", tone: "bg-[#eef2ff]" },
    ],
    tasks: ["Manage employees", "Assign claims", "Generate reports"],
  },
  agent: {
    label: "Insurance Agent",
    metrics: [
      { label: "Assigned customers", value: "218", tone: "bg-[#e9f8f6]" },
      { label: "Policies created", value: "64", tone: "bg-[#fff4e1]" },
      { label: "Claims in review", value: "19", tone: "bg-[#eef2ff]" },
    ],
    tasks: ["Register customers", "Create policies", "Verify documents"],
  },
  customer: {
    label: "Customer",
    metrics: [
      { label: "Active policies", value: "3", tone: "bg-[#e9f8f6]" },
      { label: "Premiums due", value: "1", tone: "bg-[#fff4e1]" },
      { label: "Claims tracked", value: "2", tone: "bg-[#eef2ff]" },
    ],
    tasks: ["View policies", "Pay premiums", "Submit claims"],
  },
};

export default function DashboardClient() {
  const router = useRouter();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const storedSession = getStoredSession();

    if (!storedSession) {
      router.replace("/login");
      return;
    }

    const loadProfile = async () => {
      try {
        const response = await authApi.me(storedSession.token);

        if (response.data) {
          const refreshedSession = {
            ...storedSession,
            user: response.data.user,
            expiresAt: response.data.session.expiresAt,
          };
          saveSession(refreshedSession);
          setSession(refreshedSession);
        }
      } catch {
        clearSession();
        toast.error("Your session has expired. Please log in again.");
        router.replace("/login");
      } finally {
        setIsLoading(false);
      }
    };

    loadProfile();
  }, [router]);

  const handleLogout = async () => {
    if (!session) {
      return;
    }

    setError("");
    const toastId = toast.loading("Signing out...");

    try {
      await authApi.logout(session.token);
      toast.success("Logged out successfully.", { id: toastId });
    } catch {
      setError("The server could not confirm logout, so this browser was cleared.");
      toast.error("API logout failed, but this browser session was cleared.", {
        id: toastId,
      });
    } finally {
      clearSession();
      router.replace("/login");
    }
  };

  if (isLoading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#eef3f6] px-5 text-[#15222f]">
        <div className="rounded-lg border border-[#dfe7ef] bg-white px-8 py-6 text-center shadow-[0_18px_45px_rgba(21,34,47,0.12)]">
          <p className="text-sm font-black uppercase tracking-[0.18em] text-[#0f766e]">
            Verifying session
          </p>
          <p className="mt-3 text-sm text-[#667987]">
            Loading your insurance workspace.
          </p>
        </div>
      </main>
    );
  }

  if (!session) {
    return null;
  }

  const currentRole = roleDashboard[session.user.role];

  return (
    <main className="min-h-screen bg-[#eef3f6] text-[#15222f]">
      <header className="border-b border-[#d6e1ea] bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#bd6230]">
              Insurance Management
            </p>
            <h1 className="mt-2 text-2xl font-black text-[#102a43]">
              Welcome, {session.user.fullName}
            </h1>
          </div>
          <button
            className="h-10 rounded-md border border-[#cfdbe5] bg-white px-5 text-sm font-black text-[#17313d] transition hover:border-[#0f766e] hover:text-[#0f766e]"
            onClick={handleLogout}
            type="button"
          >
            Logout
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 py-8">
        {error && (
          <div className="mb-5 rounded-md border border-[#f3b8a9] bg-[#fff4f0] px-4 py-3 text-sm font-semibold text-[#a23b24]">
            {error}
          </div>
        )}

        <div className="grid gap-5 md:grid-cols-3">
          {currentRole.metrics.map((metric) => (
            <article
              key={metric.label}
              className={`${metric.tone} rounded-lg border border-white p-6 shadow-[0_14px_35px_rgba(21,34,47,0.08)]`}
            >
              <p className="text-sm font-bold text-[#5e7180]">
                {metric.label}
              </p>
              <p className="mt-3 text-4xl font-black text-[#102a43]">
                {metric.value}
              </p>
            </article>
          ))}
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_360px]">
          <section className="rounded-lg border border-[#dfe7ef] bg-white p-6 shadow-[0_14px_35px_rgba(21,34,47,0.08)]">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.16em] text-[#0f766e]">
                  Authentication
                </p>
                <h2 className="mt-2 text-xl font-black text-[#102a43]">
                  Session is active
                </h2>
              </div>
              <span className="w-fit rounded-md bg-[#effbf7] px-4 py-2 text-sm font-black text-[#0f5f58]">
                {currentRole.label}
              </span>
            </div>

            <div className="mt-6 grid gap-3">
              {[
                ["Email", session.user.email],
                ["Account status", session.user.status],
                ["Session expires", new Date(session.expiresAt).toLocaleString()],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex flex-col gap-1 rounded-md border border-[#edf1f5] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="text-sm font-semibold text-[#6a7f90]">
                    {label}
                  </span>
                  <span className="break-all text-sm font-black text-[#17313d]">
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <aside className="rounded-lg border border-[#dfe7ef] bg-[#12333d] p-6 text-white shadow-[0_14px_35px_rgba(21,34,47,0.12)]">
            <p className="text-sm font-black uppercase tracking-[0.16em] text-[#b7e5dc]">
              Next modules
            </p>
            <div className="mt-5 space-y-4">
              {currentRole.tasks.map((item) => (
                <div
                  key={item}
                  className="rounded-md border border-white/12 bg-white/8 px-4 py-3"
                >
                  <p className="font-black">{item}</p>
                  <p className="mt-1 text-sm text-[#c8d9de]">
                    Ready for the upcoming development days.
                  </p>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
