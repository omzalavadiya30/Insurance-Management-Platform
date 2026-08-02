"use client";

import SidebarNav from "@/components/common/SidebarNav";
import { BarChart4, CreditCard, FileText, Folder, Home, ShieldCheck, Settings2, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { ComponentType, SVGProps, useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  AuthRole,
  AuthSession,
  authApi,
  clearSession,
  getStoredSession,
  saveSession,
} from "@/lib/auth";
import {
  Customer,
  CustomerStatus,
  CustomerListResponse,
  customerApi,
} from "@/lib/customer";

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
    tasks: [
      "Manage employees",
      "Manage customers",
      "Create insurance policies",
      "Assign claims",
      "Generate reports",
    ],
  },
  agent: {
    label: "Insurance Agent",
    metrics: [
      { label: "Assigned customers", value: "218", tone: "bg-[#e9f8f6]" },
      { label: "Policies created", value: "64", tone: "bg-[#fff4e1]" },
      { label: "Claims in review", value: "19", tone: "bg-[#eef2ff]" },
    ],
    tasks: [
      "Register customers",
      "Create policies",
      "Verify customer documents",
      "Review claims",
      "Update policy information",
    ],
  },
  customer: {
    label: "Customer",
    metrics: [
      { label: "Active policies", value: "3", tone: "bg-[#e9f8f6]" },
      { label: "Premiums due", value: "1", tone: "bg-[#fff4e1]" },
      { label: "Claims tracked", value: "2", tone: "bg-[#eef2ff]" },
    ],
    tasks: [
      "View policies",
      "Download policy documents",
      "Pay premiums",
      "Upload claim documents",
      "Submit claims",
      "Track claim status",
    ],
  },
};

const quickActions = [
  {
    title: "Customer Management",
    description: "Manage customer profiles, review history, and keep contact information up to date.",
  },
  {
    title: "Policy Management",
    description: "Create, renew, and monitor policies with premium and expiry visibility.",
  },
  {
    title: "Claim Management",
    description: "Review claims, verify documents, and handle approvals or rejections.",
  },
  {
    title: "Premium Tracking",
    description: "Track premium payments, due dates, and overdue alerts for customer accounts.",
  },
  {
    title: "Document Management",
    description: "Manage identity and policy documents with secure upload and download workflows.",
  },
];

const dashboardSections: Array<{
  key: string;
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
}> = [
  { key: "Dashboard", label: "Dashboard", Icon: Home },
  { key: "Customers", label: "Customers", Icon: Users },
  { key: "Policies", label: "Policies", Icon: ShieldCheck },
  { key: "Claims", label: "Claims", Icon: FileText },
  { key: "Premiums", label: "Premiums", Icon: CreditCard },
  { key: "Documents", label: "Documents", Icon: Folder },
  { key: "Reports", label: "Reports", Icon: BarChart4 },
  { key: "Settings", label: "Settings", Icon: Settings2 },
];

export default function DashboardClient() {
  const router = useRouter();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCustomerListLoading, setIsCustomerListLoading] = useState(false);
  const [activeSection, setActiveSection] = useState("Dashboard");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<CustomerStatus | "">("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const loadCustomers = useCallback(
    async (token: string, currentPage = 1) => {
      setIsCustomerListLoading(true);

      try {
        const response = await customerApi.list(token, {
          search,
          status: status || undefined,
          page: currentPage,
          limit: 10,
        });
        setCustomers(response.data?.customers || []);
        setTotal(response.data?.total || 0);
        setPage(response.data?.page || currentPage);
      } finally {
        setIsCustomerListLoading(false);
      }
    },
    [search, status]
  );

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

          if (refreshedSession.user.role === "customer") {
            router.replace("/profile");
            return;
          }

          await loadCustomers(refreshedSession.token, 1);
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
  }, [loadCustomers, router]);

  const handleLogout = async () => {
    const toastId = toast.loading("Signing out...");

    try {
      if (session) {
        await authApi.logout(session.token);
      }
      toast.success("Logged out successfully.", { id: toastId });
    } catch {
      toast.error("Logout failed. Clearing session locally.", { id: toastId });
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
  const sectionTitle = activeSection === "Dashboard" ? "Overview" : activeSection;
  const roleBadge = session.user.role === "customer" ? "Customer" : "Admin / Agent";
  const sectionSubtitle =
    activeSection === "Dashboard"
      ? session.user.role === "customer"
        ? "Track your policy, update your profile, and submit claims from your personal portal."
        : "Manage customers, review history, and control CRM workflows for your team."
      : `Viewing ${activeSection} section for your insurance workflow.`;

  const loadCustomerDetails = async (customerId: string) => {
    if (!session) {
      return;
    }

    try {
      const response = await customerApi.getById(session.token, customerId);
      setSelectedCustomer(response.data?.customer || null);
      setActiveSection("Customers");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load customer details.");
    }
  };

  const handleCustomerSearch = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!session) {
      return;
    }

    await loadCustomers(session.token, 1);
  };

  return (
    <main className="min-h-screen bg-[#edf2f6] text-[#15222f]">
      <div className="grid min-h-screen lg:grid-cols-[280px_minmax(0,1fr)]">
        <SidebarNav items={dashboardSections} selectedKey={activeSection} onSelect={setActiveSection} />
        <section className="px-4 py-6 sm:px-6 lg:px-8">
          <div className="mb-6 flex flex-col gap-4 rounded-3xl border border-[#d9e2ea] bg-white p-5 shadow-[0_20px_50px_rgba(15,23,42,0.08)] sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm uppercase tracking-[0.18em] text-[#0f766e]">
                  {activeSection}
                </p>
                <span className="rounded-full border border-[#cbd5e1] bg-[#f8fafc] px-3 py-1 text-xs font-black uppercase text-[#0f766e]">
                  {roleBadge}
                </span>
              </div>
              <h1 className="mt-2 text-3xl font-black text-[#102a43]">
                Welcome back, {session.user.fullName}
              </h1>
              <p className="mt-2 text-sm text-[#64748b]">
                {activeSection === "Dashboard"
                  ? "This is your tailored portal for role-based insurance operations."
                  : `You are viewing the ${activeSection} section for your insurance workspace.`}
              </p>

            </div>
            <div className="grid w-full gap-3 sm:w-auto sm:grid-cols-3">
              <button
                type="button"
                onClick={() => setActiveSection("Customers")}
                className="h-11 rounded-2xl border border-[#d9e2ea] bg-white px-4 text-sm font-black text-[#0f766e] transition hover:bg-[#eef7f7]"
              >
                Client ID
              </button>
              <button
                type="button"
                onClick={() => router.push("/policies")}
                className="h-11 rounded-2xl border border-[#0f766e] bg-[#0f766e] px-4 text-sm font-black text-white transition hover:bg-[#0b5f59]"
              >
                New Policy
              </button>
              <button
                className="h-11 rounded-2xl border border-[#d9e2ea] bg-white px-4 text-sm font-black text-[#0f766e] transition hover:bg-[#eef7f7]"
                onClick={handleLogout}
                type="button"
              >
                Logout
              </button>
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-[1.4fr_0.8fr]">
            <div className="space-y-5">
              <section className="overflow-hidden rounded-3xl border border-[#d9e2ea] bg-white shadow-[0_20px_50px_rgba(15,23,42,0.08)]">
                <div className="border-b border-[#edf2f7] px-5 py-6">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-[#0f766e]">
                      {sectionTitle}
                    </p>
                    <h2 className="mt-2 text-2xl font-black text-[#102a43]">
                      {activeSection}
                    </h2>
                    <p className="mt-2 text-sm text-[#64748b]">
                      {sectionSubtitle}
                    </p>
                  </div>
                </div>

                {activeSection === "Dashboard" && (
                  <div className="space-y-5 p-5">
                    <div className="grid gap-5 lg:grid-cols-3">
                      {currentRole.metrics.map((metric) => (
                        <div key={metric.label} className={`rounded-3xl border border-[#e2e8f0] p-5 ${metric.tone}`}>
                          <p className="text-sm text-[#475569]">{metric.label}</p>
                          <p className="mt-3 text-3xl font-black text-[#102a43]">{metric.value}</p>
                        </div>
                      ))}
                    </div>
                    <div className="rounded-3xl border border-[#d9e2ea] bg-[#f8fafc] p-5">
                      <p className="text-sm uppercase tracking-[0.18em] text-[#0f766e]">Role tasks</p>
                      <div className="mt-4 grid gap-3 sm:grid-cols-3">
                        {currentRole.tasks.map((task) => (
                          <div key={task} className="rounded-3xl bg-white p-4 shadow-sm">
                            <p className="font-black text-[#102a43]">{task}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {activeSection === "Customers" && (
                  <div className="space-y-5 p-5">
                    <div className="rounded-3xl border border-[#d9e2ea] bg-[#f8fbfd] p-6">
                      <p className="text-sm uppercase tracking-[0.18em] text-[#0f766e]">Customer management</p>
                      <p className="mt-3 text-sm text-[#64748b]">Search customers, review account details, and manage customer records from a single dashboard.</p>
                    </div>
                    <div className="rounded-3xl border border-[#d9e2ea] p-5">
                      <form className="grid gap-3 sm:grid-cols-[1.5fr_1fr_auto]" onSubmit={handleCustomerSearch}>
                        <input
                          type="text"
                          value={search}
                          onChange={(event) => setSearch(event.target.value)}
                          placeholder="Search customers by name, email, or code"
                          className="min-h-12 w-full rounded-2xl border border-[#cbd5e1] bg-[#f8fafc] px-4 text-sm text-[#102a43] outline-none transition focus:border-[#0f766e] focus:ring-4 focus:ring-[#a7f3d0]/50"
                        />
                        <select
                          value={status}
                          onChange={(event) => setStatus(event.target.value as CustomerStatus | "")}
                          className="min-h-12 w-full rounded-2xl border border-[#cbd5e1] bg-white px-4 text-sm text-[#102a43] outline-none transition focus:border-[#0f766e] focus:ring-4 focus:ring-[#a7f3d0]/50"
                        >
                          <option value="">All statuses</option>
                          <option value="active">Active</option>
                          <option value="disabled">Disabled</option>
                        </select>
                        <button
                          type="submit"
                          className="min-h-12 rounded-2xl bg-[#0f766e] px-5 text-sm font-black uppercase text-white transition hover:bg-[#0c5f55]"
                        >
                          Search
                        </button>
                      </form>
                    </div>
                    <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
                      <div className="rounded-3xl border border-[#d9e2ea] p-5">
                        <div className="mb-4 flex items-center justify-between gap-4">
                          <div>
                            <p className="text-sm uppercase tracking-[0.18em] text-[#0f766e]">Customer list</p>
                            <h3 className="mt-2 text-xl font-black text-[#102a43]">{total || 0} customers</h3>
                          </div>
                          <p className="text-sm text-[#64748b]">Page {page}</p>
                        </div>
                        <div className="space-y-3">
                          {isCustomerListLoading ? (
                            <p className="text-sm text-[#64748b]">Loading customer records...</p>
                          ) : customers.length === 0 ? (
                            <p className="text-sm text-[#64748b]">No customers found. Adjust the filters or try a different search term.</p>
                          ) : (
                            <div className="space-y-3">
                              {customers.map((customer) => (
                                <button
                                  key={customer.id}
                                  type="button"
                                  onClick={() => loadCustomerDetails(customer.id)}
                                  className="w-full rounded-3xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-4 text-left transition hover:border-[#0f766e] hover:bg-white"
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <div>
                                      <p className="font-black text-[#102a43]">{customer.fullName}</p>
                                      <p className="mt-1 text-sm text-[#64748b]">{customer.email}</p>
                                    </div>
                                    <span className="rounded-full bg-[#e0f2fe] px-3 py-1 text-xs font-bold uppercase text-[#0369a1]">
                                      {customer.status}
                                    </span>
                                  </div>
                                  <p className="mt-3 text-sm text-[#475569]">{customer.customerCode || "Customer ID: " + customer.id}</p>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="rounded-3xl border border-[#d9e2ea] p-5">
                        <p className="text-sm uppercase tracking-[0.18em] text-[#0f766e]">Selected customer</p>
                        {selectedCustomer ? (
                          <div className="mt-5 space-y-4">
                            <div>
                              <p className="text-sm text-[#64748b]">Name</p>
                              <p className="mt-1 font-black text-[#102a43]">{selectedCustomer.fullName}</p>
                            </div>
                            <div>
                              <p className="text-sm text-[#64748b]">Email</p>
                              <p className="mt-1 text-[#102a43]">{selectedCustomer.email}</p>
                            </div>
                            <div>
                              <p className="text-sm text-[#64748b]">Phone</p>
                              <p className="mt-1 text-[#102a43]">{selectedCustomer.phone || "Not provided"}</p>
                            </div>
                            <div>
                              <p className="text-sm text-[#64748b]">Address</p>
                              <p className="mt-1 text-[#102a43]">{selectedCustomer.address || "Not provided"}</p>
                            </div>
                            <div className="rounded-3xl border border-[#d9e2ea] bg-[#f8fafc] p-4">
                              <p className="text-sm uppercase tracking-[0.18em] text-[#0f766e]">Policy count</p>
                              <p className="mt-2 text-2xl font-black text-[#102a43]">—</p>
                              <p className="mt-1 text-sm text-[#64748b]">Open the customer record to review policies and account status.</p>
                            </div>
                          </div>
                        ) : (
                          <p className="mt-5 text-sm text-[#64748b]">Select a customer from the list to review details here.</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {activeSection === "Insurance" && (
                  <div className="p-5">
                    <div className="rounded-3xl border border-[#d9e2ea] bg-[#f8fbfd] p-6">
                      <p className="text-sm uppercase tracking-[0.18em] text-[#0f766e]">Insurance overview</p>
                      <p className="mt-3 text-sm text-[#64748b]">Review policy categories, coverage status, and upcoming renewals in one place.</p>
                    </div>
                  </div>
                )}

                {activeSection === "Reports" && (
                  <div className="p-5">
                    <div className="rounded-3xl border border-[#d9e2ea] p-6">
                      <p className="text-sm uppercase tracking-[0.18em] text-[#0f766e]">Reports center</p>
                      <p className="mt-3 text-sm text-[#64748b]">Generate claim summaries, premium reports, and customer engagement insights.</p>
                    </div>
                  </div>
                )}

                {activeSection === "Vehicle Docs" && (
                  <div className="space-y-5 p-5">
                    <div className="rounded-3xl border border-[#d9e2ea] bg-[#f8fbfd] p-6">
                      <p className="text-sm uppercase tracking-[0.18em] text-[#0f766e]">Vehicle documents</p>
                      <p className="mt-3 text-sm text-[#64748b]">Monitor registration, insurance, and PUC expiry status for your fleet.</p>
                    </div>
                  </div>
                )}

                {activeSection === "Settings" && (
                  <div className="p-5">
                    <div className="rounded-3xl border border-[#d9e2ea] bg-[#f8fbfd] p-6">
                      <p className="text-sm uppercase tracking-[0.18em] text-[#0f766e]">Workspace settings</p>
                      <p className="mt-3 text-sm text-[#64748b]">Update your account settings, notification preferences, and security options.</p>
                    </div>
                  </div>
                )}
              </section>
            </div>
            <aside className="space-y-5">
              <div className="rounded-3xl border border-[#d9e2ea] bg-white p-5 shadow-[0_20px_50px_rgba(15,23,42,0.08)]">
                <p className="text-xs uppercase tracking-[0.18em] text-[#0f766e]">Overdue Premium</p>
                <div className="mt-5 rounded-3xl border border-[#f1f5f9] bg-[#fffbf4] p-5">
                  <p className="text-sm text-[#7c5e36]">No data available in table</p>
                </div>
              </div>

              <div className="rounded-3xl border border-[#d9e2ea] bg-[#0f766e] p-5 text-white shadow-[0_20px_50px_rgba(15,23,42,0.08)]">
                <p className="text-xs uppercase tracking-[0.18em] text-[#9ae6df]">Quick Actions</p>
                <div className="mt-4 space-y-3">
                  {quickActions.map((action) => (
                    <div key={action.title} className="rounded-3xl bg-white/10 p-4">
                      <p className="font-black text-white">{action.title}</p>
                      <p className="mt-2 text-sm text-[#bae9e3]">{action.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}
