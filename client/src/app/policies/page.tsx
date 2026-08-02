"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import SidebarNav from "@/components/common/SidebarNav";
import { BarChart4, CreditCard, FileText, Folder, Home, ShieldCheck, Users } from "lucide-react";
import { ApiError, AuthSession, authApi, clearSession, getStoredSession, saveSession } from "@/lib/auth";
import { customerApi, Policy, PolicyCreatePayload } from "@/lib/customer";

const navItems = [
  { key: "Dashboard", label: "Dashboard", Icon: Home, href: "/dashboard" },
  { key: "Customers", label: "Customers", Icon: Users, href: "/customers" },
  { key: "Policies", label: "Policies", Icon: ShieldCheck, href: "/policies" },
  { key: "Claims", label: "Claims", Icon: FileText, href: "/claims" },
  { key: "Premiums", label: "Premiums", Icon: CreditCard, href: "/premiums" },
  { key: "Documents", label: "Documents", Icon: Folder, href: "/documents" },
  { key: "Reports", label: "Reports", Icon: BarChart4, href: "/reports" },
];

const defaultPolicyForm: PolicyCreatePayload = {
  policyType: "health",
  premiumAmount: 0,
  startDate: "",
  endDate: "",
  status: "active",
};

const policyTypeOptions: Array<{ label: string; value: PolicyCreatePayload["policyType"] }> = [
  { label: "Life", value: "life" },
  { label: "Health", value: "health" },
  { label: "Auto", value: "auto" },
  { label: "Home", value: "home" },
  { label: "Travel", value: "travel" },
  { label: "Business", value: "business" },
];

const policyStatusOptions: Array<{ label: string; value: PolicyCreatePayload["status"] }> = [
  { label: "Active", value: "active" },
  { label: "Draft", value: "draft" },
  { label: "Expired", value: "expired" },
  { label: "Cancelled", value: "cancelled" },
];

export default function PoliciesPage() {
  const router = useRouter();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [form, setForm] = useState<PolicyCreatePayload>(defaultPolicyForm);
  const [submissionError, setSubmissionError] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const storedSession = getStoredSession();

    if (!storedSession) {
      router.replace("/login");
      return;
    }

    const loadSession = async () => {
      try {
        const response = await authApi.me(storedSession.token);

        if (!response.data) {
          throw new Error("Session could not be verified.");
        }

        const refreshedSession = {
          ...storedSession,
          user: response.data.user,
          expiresAt: response.data.session.expiresAt,
        };
        saveSession(refreshedSession);
        setSession(refreshedSession);

        if (refreshedSession.user.role === "customer") {
          const policyResponse = await customerApi.mePolicies(refreshedSession.token);
          setPolicies(policyResponse.data?.policies || []);
        } else {
          setPolicies([]);
        }
      } catch (error) {
        clearSession();
        toast.error(error instanceof Error ? error.message : "Please log in again.");
        router.replace("/login");
      } finally {
        setIsLoading(false);
      }
    };

    loadSession();
  }, [router]);

  const isCustomer = session?.user.role === "customer";
  const canManagePolicies = session?.user.role === "admin" || session?.user.role === "agent";

  const visiblePolicies = useMemo(() => policies, [policies]);

  const handleChange = (field: keyof PolicyCreatePayload) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const value = field === "premiumAmount" ? Number(event.target.value) : event.target.value;
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleCreatePolicy = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!session) {
      return;
    }

    setSubmissionError("");

    if (!selectedCustomerId.trim()) {
      setSubmissionError("Select a customer ID to create a policy.");
      return;
    }

    if (!form.startDate || !form.endDate) {
      setSubmissionError("Please choose valid start and end dates.");
      return;
    }

    if (form.endDate < form.startDate) {
      setSubmissionError("End date must be the same as or after the start date.");
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading("Creating policy...");

    try {
      const response = await customerApi.createPolicy(session.token, selectedCustomerId, form);
      const createdPolicy = response.data?.policy;

      if (createdPolicy) {
        setPolicies((current) => [createdPolicy, ...current]);
        setForm(defaultPolicyForm);
        toast.success("Policy created successfully.", { id: toastId });
      }
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Unable to create policy.";
      setSubmissionError(message);
      toast.error(message, { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#eef3f6] px-5 text-[#15222f]">
        <div className="rounded-lg border border-[#dfe7ef] bg-white px-8 py-6 text-center shadow-[0_18px_45px_rgba(21,34,47,0.12)]">
          <p className="text-sm font-black uppercase tracking-[0.18em] text-[#0f766e]">Loading policies</p>
          <p className="mt-3 text-sm text-[#667987]">Preparing the policy management dashboard.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#eef3f6] text-[#15222f]">
      <div className="grid min-h-screen lg:grid-cols-[280px_minmax(0,1fr)]">
        <SidebarNav items={navItems} selectedKey="Policies" />

        <section className="px-4 py-6 sm:px-6 lg:px-8">
          <div className="rounded-3xl border border-[#dfe7ef] bg-white p-6 shadow-[0_14px_35px_rgba(21,34,47,0.08)]">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#0f766e]">Policy Management</p>
                <h2 className="mt-2 text-3xl font-black text-[#102a43]">Manage insurance policies</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[#64748b]">
                  Create policies, view active coverage, and track policy dates from one place.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-5 xl:grid-cols-[1.4fr_0.8fr]">
            <div className="space-y-5">
              <div className="rounded-3xl border border-[#dfe7ef] bg-white p-6 shadow-[0_14px_35px_rgba(21,34,47,0.08)]">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm uppercase tracking-[0.18em] text-[#0f766e]">Policy catalogue</p>
                    <h3 className="mt-2 text-xl font-black text-[#102a43]">Your current policies</h3>
                  </div>
                  <div>
                    <p className="text-sm text-[#64748b]">View the most recent policy records and status updates.</p>
                  </div>
                </div>

                <div className="mt-6 overflow-hidden rounded-3xl border border-[#eef2f7] bg-[#f8fbfd]">
                  <table className="min-w-full divide-y divide-[#e2e8f0] text-left text-sm">
                    <thead className="bg-white text-[#334155]">
                      <tr>
                        <th className="px-4 py-3">Policy #</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Premium</th>
                        <th className="px-4 py-3">Period</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e2e8f0] bg-white">
                      {visiblePolicies.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-6 text-center text-sm text-[#64748b]">
                            No policies found. Create a policy or select a customer to load their policies.
                          </td>
                        </tr>
                      ) : (
                        visiblePolicies.map((policy) => (
                          <tr key={policy.id}>
                            <td className="px-4 py-4 font-black text-[#102a43]">{policy.policyNumber}</td>
                            <td className="px-4 py-4 text-[#475569]">{policy.policyType}</td>
                            <td className="px-4 py-4 text-[#334155]">{policy.status}</td>
                            <td className="px-4 py-4 text-[#334155]">Rs {policy.premiumAmount}</td>
                            <td className="px-4 py-4 text-[#334155]">
                              {policy.startDate} → {policy.endDate}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <aside className="space-y-5">
              <div className="rounded-3xl border border-[#dfe7ef] bg-white p-6 shadow-[0_14px_35px_rgba(21,34,47,0.08)]">
                <p className="text-sm font-black uppercase tracking-[0.18em] text-[#0f766e]">Create policy</p>
                <p className="mt-2 text-sm leading-6 text-[#64748b]">
                  {canManagePolicies
                    ? "Create a policy for a customer account."
                    : "Customers can view their active policies here."}
                </p>

                {canManagePolicies ? (
                  <form className="mt-6 space-y-4" onSubmit={handleCreatePolicy}>
                    <label className="grid gap-2 text-sm font-semibold text-[#334155]">
                      Customer ID
                      <input
                        className="h-11 rounded-md border border-[#cfdbe5] bg-white px-3 text-sm text-[#15222f] outline-none transition focus:border-[#0f766e] focus:ring-4 focus:ring-[#a7f3d0]/45"
                        value={selectedCustomerId}
                        onChange={(event) => setSelectedCustomerId(event.target.value)}
                        placeholder="Customer ID"
                      />
                    </label>

                    <label className="grid gap-2 text-sm font-semibold text-[#334155]">
                      Policy Type
                      <select
                        className="h-11 rounded-md border border-[#cfdbe5] bg-white px-3 text-sm text-[#15222f] outline-none transition focus:border-[#0f766e] focus:ring-4 focus:ring-[#a7f3d0]/45"
                        value={form.policyType}
                        onChange={handleChange("policyType")}
                      >
                        {policyTypeOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="grid gap-2 text-sm font-semibold text-[#334155]">
                      Premium Amount
                      <input
                        className="h-11 rounded-md border border-[#cfdbe5] bg-white px-3 text-sm text-[#15222f] outline-none transition focus:border-[#0f766e] focus:ring-4 focus:ring-[#a7f3d0]/45"
                        type="number"
                        min={0}
                        value={form.premiumAmount}
                        onChange={handleChange("premiumAmount")}
                        placeholder="Premium amount"
                      />
                    </label>

                    <label className="grid gap-2 text-sm font-semibold text-[#334155]">
                      Start Date
                      <input
                        className="h-11 rounded-md border border-[#cfdbe5] bg-white px-3 text-sm text-[#15222f] outline-none transition focus:border-[#0f766e] focus:ring-4 focus:ring-[#a7f3d0]/45"
                        type="date"
                        value={form.startDate}
                        onChange={handleChange("startDate")}
                      />
                    </label>

                    <label className="grid gap-2 text-sm font-semibold text-[#334155]">
                      End Date
                      <input
                        className="h-11 rounded-md border border-[#cfdbe5] bg-white px-3 text-sm text-[#15222f] outline-none transition focus:border-[#0f766e] focus:ring-4 focus:ring-[#a7f3d0]/45"
                        type="date"
                        value={form.endDate}
                        onChange={handleChange("endDate")}
                      />
                    </label>

                    <label className="grid gap-2 text-sm font-semibold text-[#334155]">
                      Status
                      <select
                        className="h-11 rounded-md border border-[#cfdbe5] bg-white px-3 text-sm text-[#15222f] outline-none transition focus:border-[#0f766e] focus:ring-4 focus:ring-[#a7f3d0]/45"
                        value={form.status}
                        onChange={handleChange("status")}
                      >
                        {policyStatusOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    {submissionError && (
                      <p className="text-sm font-semibold text-[#b23b21]">{submissionError}</p>
                    )}

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="inline-flex h-11 w-full items-center justify-center rounded-md bg-[#0f766e] px-4 text-sm font-black text-white transition hover:bg-[#0b5f59] disabled:cursor-not-allowed disabled:bg-[#94a3b8]"
                    >
                      {isSubmitting ? "Creating policy..." : "Create policy"}
                    </button>
                  </form>
                ) : (
                  <div className="mt-6 rounded-3xl border border-[#e2e8f0] bg-[#f8fbfd] p-4 text-sm text-[#64748b]">
                    Customer users can only view policies here.
                  </div>
                )}
              </div>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}
