"use client";

import SidebarNav from "@/components/common/SidebarNav";
import { CreditCard, FileText, HelpCircle, Home, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { ApiError, AuthSession, authApi, clearSession, getStoredSession, saveSession } from "@/lib/auth";
import { Customer, customerApi } from "@/lib/customer";

type ProfileTab = "Overview" | "Policies" | "Claims" | "Premiums" | "Support";

export default function CustomerProfileClient() {
  const router = useRouter();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<ProfileTab>("Overview");
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    dateOfBirth: "",
    address: "",
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const dashboardMetrics = [
    { label: "Active Policies", value: "3", description: "Policies currently active on your account." },
    { label: "Premiums Due", value: "1", description: "Payments due in the next 30 days." },
    { label: "Claims in Progress", value: "2", description: "Claims currently being reviewed." },
  ];

  const customerActions = [
    { title: "View Policies", description: "Check your active insurance policies and coverage details." },
    { title: "Pay Premium", description: "Review due amounts and complete premium payments securely." },
    { title: "Submit Claim", description: "Upload claim documents and track your claim status." },
    { title: "Update Profile", description: "Keep your identity and contact details up to date." },
  ];

  const customerNavItems = [
    { key: "Dashboard", label: "Dashboard", Icon: Home },
    { key: "Profile", label: "Profile", Icon: User },
    { key: "Claims", label: "Claims", Icon: FileText },
    { key: "Premiums", label: "Premiums", Icon: CreditCard },
    { key: "Support", label: "Support", Icon: HelpCircle },
  ];

  useEffect(() => {
    const storedSession = getStoredSession();

    if (!storedSession) {
      router.replace("/login");
      return;
    }

    const loadProfile = async () => {
      let customerResponse = null;

      try {
        const profileResponse = await authApi.me(storedSession.token);

        if (!profileResponse.data) {
          throw new Error("Session could not be verified.");
        }

        const refreshedSession = {
          ...storedSession,
          user: profileResponse.data.user,
          expiresAt: profileResponse.data.session.expiresAt,
        };
        saveSession(refreshedSession);
        setSession(refreshedSession);

        if (refreshedSession.user.role === "customer") {
          customerResponse = await customerApi.me(refreshedSession.token);
          setCustomer(customerResponse.data?.customer || null);

          if (customerResponse.data?.customer) {
            setForm({
              fullName: customerResponse.data.customer.fullName,
              phone: customerResponse.data.customer.phone || "",
              dateOfBirth: customerResponse.data.customer.dateOfBirth || "",
              address: customerResponse.data.customer.address || "",
            });
          }
        } else {
          setCustomer(null);
        }
      } catch (caughtError) {
        clearSession();
        const message = caughtError instanceof Error ? caughtError.message : "Please log in again.";
        toast.error(message);
        router.replace("/login");
      } finally {
        setIsLoading(false);
      }
    };

    loadProfile();
  }, [router]);

  const updateField = (field: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
    setFieldErrors((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!session) {
      return;
    }

    setFieldErrors({});
    const nextErrors: Record<string, string> = {};

    if (!form.fullName.trim()) nextErrors.fullName = "Full name is required.";
    if (!form.phone.trim()) nextErrors.phone = "Phone number is required.";
    if (!form.dateOfBirth) nextErrors.dateOfBirth = "Date of birth is required.";
    if (!form.address.trim()) nextErrors.address = "Address is required.";

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }

    setIsSaving(true);
    const toastId = toast.loading("Saving profile...");

    try {
      const response = await customerApi.updateMe(session.token, {
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        dateOfBirth: form.dateOfBirth,
        address: form.address.trim(),
      });

      if (response.data?.customer) {
        setCustomer(response.data.customer);
        setForm({
          fullName: response.data.customer.fullName,
          phone: response.data.customer.phone || "",
          dateOfBirth: response.data.customer.dateOfBirth || "",
          address: response.data.customer.address || "",
        });
        toast.success("Profile updated successfully.", { id: toastId });
      }
    } catch (caughtError) {
      if (caughtError instanceof ApiError) {
        const details = caughtError.details || [];
        const updatedErrors: Record<string, string> = {};
        details.forEach((detail) => {
          updatedErrors[detail.field] = detail.message;
        });
        setFieldErrors(updatedErrors);
      }
      toast.error(caughtError instanceof Error ? caughtError.message : "Unable to save profile.", { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#eef3f6] px-5 text-[#15222f]">
        <div className="rounded-lg border border-[#dfe7ef] bg-white px-8 py-6 text-center shadow-[0_18px_45px_rgba(21,34,47,0.12)]">
          <p className="text-sm font-black uppercase tracking-[0.18em] text-[#0f766e]">Loading your portal</p>
          <p className="mt-3 text-sm text-[#667987]">Preparing your customer dashboard.</p>
        </div>
      </main>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <main className="min-h-screen bg-[#eef3f6] text-[#15222f]">
      <div className="grid min-h-screen lg:grid-cols-[280px_minmax(0,1fr)]">
        <SidebarNav items={customerNavItems} selectedKey={activeTab} onSelect={setActiveTab} />

        <section className="px-4 py-6 sm:px-6 lg:px-8">
          <div className="rounded-3xl border border-[#dfe7ef] bg-white p-6 shadow-[0_14px_35px_rgba(21,34,47,0.08)]">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#0f766e]">Customer Dashboard</p>
                <h2 className="mt-2 text-3xl font-black text-[#102a43]">Hello, {session.user.fullName}</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[#64748b]">
                  Here’s your dashboard to track active policies, premiums, claims, and profile updates.
                </p>
              </div>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {dashboardMetrics.map((metric) => (
                <div key={metric.label} className="rounded-3xl border border-[#e2e8f0] bg-[#f8fafc] p-5 shadow-sm">
                  <p className="text-xs uppercase tracking-[0.18em] text-[#0f766e]">{metric.label}</p>
                  <p className="mt-3 text-3xl font-black text-[#102a43]">{metric.value}</p>
                  <p className="mt-3 text-sm leading-6 text-[#64748b]">{metric.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_0.7fr]">
          <div className="rounded-3xl border border-[#dfe7ef] bg-white p-6 shadow-[0_14px_35px_rgba(21,34,47,0.08)]">
            <div className="grid gap-4">
              {activeTab === "Overview" && (
                <div className="rounded-3xl border border-[#eef2f7] bg-[#f8fbfd] p-6">
                  <p className="text-sm uppercase tracking-[0.18em] text-[#0f766e]">Overview</p>
                  <p className="mt-3 text-sm leading-6 text-[#64748b]">
                    Access your profile, active policies, premium status, and claim history in one dashboard.
                  </p>
                </div>
              )}
              {activeTab === "Policies" && (
                <div className="rounded-3xl border border-[#eef2f7] bg-[#f8fbfd] p-6">
                  <p className="text-sm uppercase tracking-[0.18em] text-[#0f766e]">Policies</p>
                  <p className="mt-3 text-sm leading-6 text-[#64748b]">
                    View policy details, renewal status, and document download options.
                  </p>
                </div>
              )}
              {activeTab === "Claims" && (
                <div className="rounded-3xl border border-[#eef2f7] bg-[#f8fbfd] p-6">
                  <p className="text-sm uppercase tracking-[0.18em] text-[#0f766e]">Claims</p>
                  <p className="mt-3 text-sm leading-6 text-[#64748b]">
                    Submit and track your claims. You can upload documents and view status updates.
                  </p>
                </div>
              )}
              {activeTab === "Premiums" && (
                <div className="rounded-3xl border border-[#eef2f7] bg-[#f8fbfd] p-6">
                  <p className="text-sm uppercase tracking-[0.18em] text-[#0f766e]">Premiums</p>
                  <p className="mt-3 text-sm leading-6 text-[#64748b]">
                    Check upcoming payments, outstanding dues, and payment history.
                  </p>
                </div>
              )}
              {activeTab === "Support" && (
                <div className="rounded-3xl border border-[#eef2f7] bg-[#f8fbfd] p-6">
                  <p className="text-sm uppercase tracking-[0.18em] text-[#0f766e]">Support</p>
                  <p className="mt-3 text-sm leading-6 text-[#64748b]">
                    Contact support for policy or claim assistance, and review help resources.
                  </p>
                </div>
              )}
            </div>
          </div>

          <aside className="rounded-3xl border border-[#dfe7ef] bg-[#f8fafc] p-6 shadow-[0_14px_35px_rgba(21,34,47,0.08)]">
            <p className="text-sm uppercase tracking-[0.18em] text-[#0f766e]">Quick actions</p>
            <div className="mt-5 grid gap-4">
              {customerActions.map((action) => (
                <div key={action.title} className="rounded-3xl border border-[#e2e8f0] bg-white p-4">
                  <p className="text-sm font-black text-[#102a43]">{action.title}</p>
                  <p className="mt-2 text-sm leading-6 text-[#64748b]">{action.description}</p>
                </div>
              ))}
            </div>
          </aside>
        </div>

        <div className="mt-6 rounded-lg border border-[#dfe7ef] bg-white p-6 shadow-[0_14px_35px_rgba(21,34,47,0.08)]">
          <p className="text-sm font-black uppercase tracking-[0.16em] text-[#0f766e]">Edit your profile</p>
          <form className="mt-5 grid gap-4" onSubmit={handleSubmit} noValidate>
            <label className="grid gap-2">
              <span className="text-sm font-bold text-[#263f4d]">Full name</span>
              <input
                className="h-11 rounded-md border border-[#cfdbe5] bg-white px-3 text-sm text-[#15222f] outline-none transition focus:border-[#0f766e] focus:ring-4 focus:ring-[#a7f3d0]/45"
                value={form.fullName}
                onChange={updateField("fullName")}
                placeholder="Your full name"
              />
              {fieldErrors.fullName && (
                <p className="text-xs font-semibold text-[#b23b21]">{fieldErrors.fullName}</p>
              )}
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-bold text-[#263f4d]">Phone</span>
              <input
                className="h-11 rounded-md border border-[#cfdbe5] bg-white px-3 text-sm text-[#15222f] outline-none transition focus:border-[#0f766e] focus:ring-4 focus:ring-[#a7f3d0]/45"
                value={form.phone}
                onChange={updateField("phone")}
                placeholder="+91 98765 43210"
              />
              {fieldErrors.phone && (
                <p className="text-xs font-semibold text-[#b23b21]">{fieldErrors.phone}</p>
              )}
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-bold text-[#263f4d]">Date of birth</span>
              <input
                className="h-11 rounded-md border border-[#cfdbe5] bg-white px-3 text-sm text-[#15222f] outline-none transition focus:border-[#0f766e] focus:ring-4 focus:ring-[#a7f3d0]/45"
                type="date"
                value={form.dateOfBirth}
                onChange={updateField("dateOfBirth")}
              />
              {fieldErrors.dateOfBirth && (
                <p className="text-xs font-semibold text-[#b23b21]">{fieldErrors.dateOfBirth}</p>
              )}
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-bold text-[#263f4d]">Address</span>
              <textarea
                className="min-h-23 rounded-md border border-[#cfdbe5] bg-white px-3 py-2 text-sm text-[#15222f] outline-none transition focus:border-[#0f766e] focus:ring-4 focus:ring-[#a7f3d0]/45"
                value={form.address}
                onChange={updateField("address")}
                placeholder="House, street, city"
              />
              {fieldErrors.address && (
                <p className="text-xs font-semibold text-[#b23b21]">{fieldErrors.address}</p>
              )}
            </label>

            <button
              type="submit"
              className="h-11 rounded-md bg-[#0f766e] px-5 text-sm font-black text-white transition hover:bg-[#0b5f59]"
              disabled={isSaving}
            >
              {isSaving ? "Updating profile..." : "Save changes"}
            </button>
          </form>
        </div>
      </section>
    </div>
  </main>
  );
}
