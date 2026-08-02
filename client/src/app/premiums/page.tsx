"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import SidebarNav from "@/components/common/SidebarNav";
import { BarChart4, CreditCard, FileText, Folder, Home, ShieldCheck, Users } from "lucide-react";
import { ApiError, AuthSession, authApi, clearSession, getStoredSession, saveSession } from "@/lib/auth";
import { Customer, CustomerStatus, Policy, PaymentRecord, customerApi } from "@/lib/customer";

const navItems = [
  { key: "Dashboard", label: "Dashboard", Icon: Home, href: "/dashboard" },
  { key: "Customers", label: "Customers", Icon: Users, href: "/customers" },
  { key: "Policies", label: "Policies", Icon: ShieldCheck, href: "/policies" },
  { key: "Claims", label: "Claims", Icon: FileText, href: "/claims" },
  { key: "Premiums", label: "Premiums", Icon: CreditCard, href: "/premiums" },
  { key: "Documents", label: "Documents", Icon: Folder, href: "/documents" },
  { key: "Reports", label: "Reports", Icon: BarChart4, href: "/reports" },
];

export default function PremiumsPage() {
  const router = useRouter();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [premiumPayments, setPremiumPayments] = useState<PaymentRecord[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<CustomerStatus | "">("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [isCustomerListLoading, setIsCustomerListLoading] = useState(false);

  const isCustomer = session?.user.role === "customer";
  const canManage = session?.user.role === "admin" || session?.user.role === "agent";

  useEffect(() => {
    const storedSession = getStoredSession();

    if (!storedSession) {
      router.replace("/login");
      return;
    }

    const loadPremiumData = async () => {
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
          const dashboardResponse = await customerApi.meDashboard(refreshedSession.token);
          setPremiumPayments(dashboardResponse.data?.premiumPayments || []);
          setPolicies(dashboardResponse.data?.policies || []);
        } else {
          await loadCustomerList(refreshedSession.token, 1);
        }
      } catch (error) {
        clearSession();
        toast.error(error instanceof Error ? error.message : "Please log in again.");
        router.replace("/login");
      } finally {
        setIsLoading(false);
      }
    };

    loadPremiumData();
  }, [router]);

  const loadCustomerList = async (token: string, currentPage = 1) => {
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
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load customers.");
    } finally {
      setIsCustomerListLoading(false);
    }
  };

  const loadCustomerPaymentOverview = async (customerId: string) => {
    if (!session) {
      return;
    }

    try {
      const [customerResponse, policyResponse, paymentsResponse] = await Promise.all([
        customerApi.getById(session.token, customerId),
        customerApi.getPolicies(session.token, customerId),
        customerApi.getPayments(session.token, customerId),
      ]);

      setSelectedCustomer(customerResponse.data?.customer || null);
      setPolicies(policyResponse.data?.policies || []);
      setPremiumPayments(paymentsResponse.data?.premiumPayments || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load customer premium overview.");
    }
  };

  const filteredPayments = useMemo(() => premiumPayments, [premiumPayments]);
  const pendingPayments = useMemo(
    () => filteredPayments.filter((payment) => payment.paymentStatus === "pending"),
    [filteredPayments]
  );
  const totalPending = useMemo(
    () => pendingPayments.reduce((sum, payment) => sum + payment.amount, 0),
    [pendingPayments]
  );

  const handleCustomerSearch = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!session) {
      return;
    }

    await loadCustomerList(session.token, 1);
  };

  if (isLoading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#eef3f6] px-5 text-[#15222f]">
        <div className="rounded-lg border border-[#dfe7ef] bg-white px-8 py-6 text-center shadow-[0_18px_45px_rgba(21,34,47,0.12)]">
          <p className="text-sm font-black uppercase tracking-[0.18em] text-[#0f766e]">Loading premium tracking</p>
          <p className="mt-3 text-sm text-[#667987]">Preparing premium payment analytics.</p>
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
        <SidebarNav items={navItems} selectedKey="Premiums" />

        <section className="px-4 py-6 sm:px-6 lg:px-8">
          <div className="rounded-3xl border border-[#dfe7ef] bg-white p-6 shadow-[0_14px_35px_rgba(21,34,47,0.08)]">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#0f766e]">Premium tracking</p>
                <h2 className="mt-2 text-3xl font-black text-[#102a43]">Track payment status and due premiums</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[#64748b]">
                  Monitor premium payments and due alerts for your policies and customer accounts.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-5 xl:grid-cols-[1.4fr_0.8fr]">
            <div className="space-y-5">
              <div className="rounded-3xl border border-[#dfe7ef] bg-white p-6 shadow-[0_14px_35px_rgba(21,34,47,0.08)]">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-3xl border border-[#e2e8f0] bg-[#f8fafc] p-5">
                    <p className="text-xs uppercase tracking-[0.18em] text-[#0f766e]">Total policies</p>
                    <p className="mt-3 text-3xl font-black text-[#102a43]">{policies.length}</p>
                  </div>
                  <div className="rounded-3xl border border-[#e2e8f0] bg-[#f8fafc] p-5">
                    <p className="text-xs uppercase tracking-[0.18em] text-[#0f766e]">Pending payments</p>
                    <p className="mt-3 text-3xl font-black text-[#102a43]">{pendingPayments.length}</p>
                  </div>
                  <div className="rounded-3xl border border-[#e2e8f0] bg-[#f8fafc] p-5">
                    <p className="text-xs uppercase tracking-[0.18em] text-[#0f766e]">Pending amount</p>
                    <p className="mt-3 text-3xl font-black text-[#102a43]">₹{totalPending}</p>
                  </div>
                </div>
              </div>

              {isCustomer ? (
                <div className="rounded-3xl border border-[#dfe7ef] bg-white p-6 shadow-[0_14px_35px_rgba(21,34,47,0.08)]">
                  <p className="text-sm uppercase tracking-[0.18em] text-[#0f766e]">Premium payment history</p>

                  {premiumPayments.length === 0 ? (
                    <p className="mt-4 text-sm leading-6 text-[#64748b]">
                      No premium payment history is available yet. Payments will appear here once they are recorded.
                    </p>
                  ) : (
                    <div className="mt-4 overflow-hidden rounded-3xl border border-[#eef2f7] bg-[#f8fbfd]">
                      <table className="min-w-full divide-y divide-[#e2e8f0] text-left text-sm">
                        <thead className="bg-white text-[#334155]">
                          <tr>
                            <th className="px-4 py-3">Date</th>
                            <th className="px-4 py-3">Amount</th>
                            <th className="px-4 py-3">Method</th>
                            <th className="px-4 py-3">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#e2e8f0] bg-white">
                          {premiumPayments.map((payment) => (
                            <tr key={payment.id}>
                              <td className="px-4 py-4 text-[#334155]">{payment.paymentDate}</td>
                              <td className="px-4 py-4 text-[#334155]">₹{payment.amount}</td>
                              <td className="px-4 py-4 text-[#334155]">{payment.paymentMethod}</td>
                              <td className="px-4 py-4 text-[#334155]">{payment.paymentStatus}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-3xl border border-[#dfe7ef] bg-white p-6 shadow-[0_14px_35px_rgba(21,34,47,0.08)]">
                  <p className="text-sm uppercase tracking-[0.18em] text-[#0f766e]">Customer premium overview</p>
                  <p className="mt-4 text-sm leading-6 text-[#64748b]">
                    Choose a customer to view premium obligations and associated policies.
                  </p>

                  <form className="mt-6 grid gap-4" onSubmit={handleCustomerSearch}>
                    <label className="grid gap-2 text-sm font-semibold text-[#334155]">
                      Search customer
                      <input
                        className="h-11 rounded-md border border-[#cfdbe5] bg-white px-3 text-sm text-[#15222f] outline-none focus:border-[#0f766e] focus:ring-4 focus:ring-[#a7f3d0]/45"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Name or ID"
                      />
                    </label>
                    <label className="grid gap-2 text-sm font-semibold text-[#334155]">
                      Status
                      <select
                        className="h-11 rounded-md border border-[#cfdbe5] bg-white px-3 text-sm text-[#15222f] outline-none focus:border-[#0f766e] focus:ring-4 focus:ring-[#a7f3d0]/45"
                        value={status}
                        onChange={(event) => setStatus(event.target.value as CustomerStatus | "")}
                      >
                        <option value="">All</option>
                        <option value="active">Active</option>
                        <option value="disabled">Disabled</option>
                      </select>
                    </label>
                    <button
                      type="submit"
                      className="h-11 rounded-md bg-[#0f766e] px-5 text-sm font-black text-white transition hover:bg-[#0b5f59]"
                    >
                      Search customers
                    </button>
                  </form>

                  <div className="mt-6 overflow-hidden rounded-3xl border border-[#eef2f7] bg-[#f8fbfd]">
                    <table className="min-w-full divide-y divide-[#e2e8f0] text-left text-sm">
                      <thead className="bg-white text-[#334155]">
                        <tr>
                          <th className="px-4 py-3">Customer</th>
                          <th className="px-4 py-3">Email</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#e2e8f0] bg-white">
                        {customers.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-4 py-6 text-center text-sm text-[#64748b]">
                              {isCustomerListLoading ? "Loading customers..." : "No customers found."}
                            </td>
                          </tr>
                        ) : (
                          customers.map((customer) => (
                            <tr key={customer.id}>
                              <td className="px-4 py-4 text-[#334155]">{customer.fullName}</td>
                              <td className="px-4 py-4 text-[#334155]">{customer.email}</td>
                              <td className="px-4 py-4 text-[#334155]">{customer.status}</td>
                              <td className="px-4 py-4">
                                <button
                                  type="button"
                                  onClick={() => loadCustomerPaymentOverview(customer.id)}
                                  className="rounded-full bg-[#0f766e] px-4 py-2 text-sm font-black text-white transition hover:bg-[#0b5f59]"
                                >
                                  Select
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <aside className="space-y-5">
              <div className="rounded-3xl border border-[#dfe7ef] bg-white p-6 shadow-[0_14px_35px_rgba(21,34,47,0.08)]">
                <p className="text-sm uppercase tracking-[0.18em] text-[#0f766e]">Premium details</p>
                {isCustomer ? (
                  <p className="mt-3 text-sm leading-6 text-[#64748b]">
                    This view shows your policy premium history and payment status.
                  </p>
                ) : (
                  <p className="mt-3 text-sm leading-6 text-[#64748b]">
                    Select a customer to view policy premium amounts and invoice status.
                  </p>
                )}

                <div className="mt-5 grid gap-4">
                  <div className="rounded-3xl border border-[#e2e8f0] bg-[#f8fafc] p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-[#0f766e]">Active policies</p>
                    <p className="mt-2 text-lg font-black text-[#102a43]">{policies.length}</p>
                  </div>
                  <div className="rounded-3xl border border-[#e2e8f0] bg-[#f8fafc] p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-[#0f766e]">Pending due amount</p>
                    <p className="mt-2 text-lg font-black text-[#102a43]">₹{totalPending}</p>
                  </div>
                </div>
              </div>

              {selectedCustomer && (
                <div className="rounded-3xl border border-[#dfe7ef] bg-white p-6 shadow-[0_14px_35px_rgba(21,34,47,0.08)]">
                  <p className="text-sm uppercase tracking-[0.18em] text-[#0f766e]">Selected customer</p>
                  <div className="mt-4 space-y-3 rounded-3xl border border-[#eef2f7] bg-[#f8fbfd] p-4">
                    <p className="text-sm font-semibold text-[#102a43]">{selectedCustomer.fullName}</p>
                    <p className="text-sm text-[#64748b]">{selectedCustomer.email}</p>
                    <p className="text-sm text-[#64748b]">Status: {selectedCustomer.status}</p>
                  </div>
                </div>
              )}

              <div className="rounded-3xl border border-[#dfe7ef] bg-white p-6 shadow-[0_14px_35px_rgba(21,34,47,0.08)]">
                <p className="text-sm uppercase tracking-[0.18em] text-[#0f766e]">Premium workflow</p>
                <p className="mt-4 text-sm leading-6 text-[#64748b]">
                  Premium tracking is designed to show due premium amounts, payment records, and policy coverage history.
                </p>
              </div>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}
