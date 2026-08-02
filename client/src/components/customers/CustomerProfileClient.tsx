"use client";

import SidebarNav from "@/components/common/SidebarNav";
import { CreditCard, FileText, Folder, Home, ShieldCheck, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { ApiError, AuthSession, authApi, clearSession, getStoredSession, saveSession } from "@/lib/auth";
import { Claim, Customer, customerApi, DocumentEntry, Policy, PaymentRecord } from "@/lib/customer";

type ProfileTab = "Overview" | "Profile" | "Policies" | "Claims" | "Premiums" | "Documents" | "Support";

export default function CustomerProfileClient() {
  const router = useRouter();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmittingClaim, setIsSubmittingClaim] = useState(false);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [isUploadingDocument, setIsUploadingDocument] = useState(false);
  const [activeTab, setActiveTab] = useState<ProfileTab>("Overview");
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    dateOfBirth: "",
    address: "",
  });
  const [claimForm, setClaimForm] = useState({ claimAmount: "", reason: "" });
  const [paymentForm, setPaymentForm] = useState({ amount: "", paymentMethod: "Online" });
  const [documentForm, setDocumentForm] = useState({ fileName: "", filePath: "" });
  const [claims, setClaims] = useState<Claim[]>([]);
  const [premiumPayments, setPremiumPayments] = useState<PaymentRecord[]>([]);
  const [documents, setDocuments] = useState<DocumentEntry[]>([]);
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
    { key: "Overview", label: "Dashboard", Icon: Home },
    { key: "Profile", label: "Profile", Icon: User },
    { key: "Policies", label: "Policies", Icon: ShieldCheck },
    { key: "Claims", label: "Claims", Icon: FileText },
    { key: "Premiums", label: "Premiums", Icon: CreditCard },
    { key: "Documents", label: "Documents", Icon: Folder },
    { key: "Support", label: "Support", Icon: Folder },
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
          const dashboardResponse = await customerApi.meDashboard(refreshedSession.token);
          setCustomer(dashboardResponse.data?.customer || null);
          setPolicies(dashboardResponse.data?.policies || []);
          setClaims(dashboardResponse.data?.claims || []);
          setDocuments(dashboardResponse.data?.documents || []);
          setPremiumPayments(dashboardResponse.data?.premiumPayments || []);

          if (dashboardResponse.data?.customer) {
            setForm({
              fullName: dashboardResponse.data.customer.fullName,
              phone: dashboardResponse.data.customer.phone || "",
              dateOfBirth: dashboardResponse.data.customer.dateOfBirth || "",
              address: dashboardResponse.data.customer.address || "",
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

  const handleClaimChange = (field: keyof typeof claimForm) => (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const value = event.target.value;
    setClaimForm((current) => ({ ...current, [field]: value }));
  };

  const handlePaymentChange = (field: keyof typeof paymentForm) => (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const value = field === "amount" ? event.target.value : event.target.value;
    setPaymentForm((current) => ({ ...current, [field]: value }));
  };

  const handleDocumentChange = (field: keyof typeof documentForm) => (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    setDocumentForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const handleSubmitClaim = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!session) {
      return;
    }

    if (!claimForm.claimAmount.trim() || !claimForm.reason.trim()) {
      toast.error("Please provide claim amount and reason.");
      return;
    }

    setIsSubmittingClaim(true);
    const toastId = toast.loading("Submitting claim...");

    try {
      await customerApi.submitClaim(session.token, {
        claimAmount: Number(claimForm.claimAmount),
        reason: claimForm.reason.trim(),
      });
      setClaimForm({ claimAmount: "", reason: "" });
      toast.success("Claim submitted successfully.", { id: toastId });
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "Unable to submit claim.";
      toast.error(message, { id: toastId });
    } finally {
      setIsSubmittingClaim(false);
    }
  };

  const handleSubmitPayment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!session) {
      return;
    }

    if (!paymentForm.amount.trim() || !paymentForm.paymentMethod.trim()) {
      toast.error("Please provide a payment amount and method.");
      return;
    }

    setIsSubmittingPayment(true);
    const toastId = toast.loading("Recording payment...");

    try {
      await customerApi.recordPayment(session.token, {
        amount: Number(paymentForm.amount),
        paymentMethod: paymentForm.paymentMethod.trim(),
      });
      setPaymentForm({ amount: "", paymentMethod: "Online" });
      toast.success("Payment recorded successfully.", { id: toastId });
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "Unable to record payment.";
      toast.error(message, { id: toastId });
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const handleUploadDocument = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!session) {
      return;
    }

    if (!documentForm.fileName.trim() || !documentForm.filePath.trim()) {
      toast.error("Please provide a document name and path.");
      return;
    }

    setIsUploadingDocument(true);
    const toastId = toast.loading("Uploading document...");

    try {
      await customerApi.uploadDocument(session.token, {
        fileName: documentForm.fileName.trim(),
        filePath: documentForm.filePath.trim(),
      });
      setDocumentForm({ fileName: "", filePath: "" });
      toast.success("Document uploaded successfully.", { id: toastId });
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "Unable to upload document.";
      toast.error(message, { id: toastId });
    } finally {
      setIsUploadingDocument(false);
    }
  };

  const handleLogout = async () => {
    if (!session) {
      return;
    }

    const toastId = toast.loading("Signing out...");

    try {
      await authApi.logout(session.token);
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
        <SidebarNav
          items={customerNavItems}
          selectedKey={activeTab}
          onSelect={(key) => setActiveTab(key as ProfileTab)}
        />

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
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex h-11 items-center justify-center rounded-2xl border border-[#d9e2ea] bg-white px-4 text-sm font-black text-[#0f766e] transition hover:bg-[#eef7f8]"
              >
                Logout
              </button>
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
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-3xl border border-[#d8e2ec] bg-white p-4">
                      <p className="text-sm font-semibold text-[#102a43]">Active policies</p>
                      <p className="mt-2 text-3xl font-black text-[#0f766e]">{policies.length}</p>
                    </div>
                    <div className="rounded-3xl border border-[#d8e2ec] bg-white p-4">
                      <p className="text-sm font-semibold text-[#102a43]">Claims submitted</p>
                      <p className="mt-2 text-3xl font-black text-[#0f766e]">{claims.length}</p>
                    </div>
                    <div className="rounded-3xl border border-[#d8e2ec] bg-white p-4">
                      <p className="text-sm font-semibold text-[#102a43]">Payments recorded</p>
                      <p className="mt-2 text-3xl font-black text-[#0f766e]">{premiumPayments.length}</p>
                    </div>
                    <div className="rounded-3xl border border-[#d8e2ec] bg-white p-4">
                      <p className="text-sm font-semibold text-[#102a43]">Documents uploaded</p>
                      <p className="mt-2 text-3xl font-black text-[#0f766e]">{documents.length}</p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "Profile" && (
                <div className="rounded-3xl border border-[#eef2f7] bg-[#f8fbfd] p-6">
                  <p className="text-sm uppercase tracking-[0.18em] text-[#0f766e]">Profile</p>
                  <div className="mt-4 space-y-4 rounded-3xl border border-[#d8e2ec] bg-white p-5">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-[#718096]">Name</p>
                      <p className="mt-1 text-lg font-black text-[#102a43]">{customer?.fullName || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-[#718096]">Phone</p>
                      <p className="mt-1 text-sm text-[#64748b]">{customer?.phone || "Not provided"}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-[#718096]">Address</p>
                      <p className="mt-1 text-sm text-[#64748b]">{customer?.address || "Not provided"}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-[#718096]">Date of birth</p>
                      <p className="mt-1 text-sm text-[#64748b]">{customer?.dateOfBirth || "Not provided"}</p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "Policies" && (
                <div className="rounded-3xl border border-[#eef2f7] bg-[#f8fbfd] p-6">
                  <p className="text-sm uppercase tracking-[0.18em] text-[#0f766e]">Policies</p>
                  {policies.length === 0 ? (
                    <p className="mt-3 text-sm leading-6 text-[#64748b]">No active policies found yet.</p>
                  ) : (
                    <div className="mt-4 grid gap-4">
                      {policies.map((policy) => (
                        <div key={policy.id} className="rounded-3xl border border-[#d8e2ec] bg-white p-5">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-sm uppercase tracking-[0.18em] text-[#718096]">{policy.policyType} insurance</p>
                              <p className="mt-1 text-lg font-black text-[#102a43]">{policy.policyNumber}</p>
                            </div>
                            <span className="rounded-full bg-[#e6fffa] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#0f766e]">
                              {policy.status}
                            </span>
                          </div>
                          <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            <p className="text-sm text-[#64748b]">Premium: ₹{policy.premiumAmount}</p>
                            <p className="text-sm text-[#64748b]">{policy.startDate} → {policy.endDate}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === "Claims" && (
                <div className="rounded-3xl border border-[#eef2f7] bg-[#f8fbfd] p-6">
                  <p className="text-sm uppercase tracking-[0.18em] text-[#0f766e]">Claims</p>
                  <div className="mt-4 space-y-4">
                    {claims.length === 0 ? (
                      <p className="text-sm leading-6 text-[#64748b]">No claims have been submitted yet.</p>
                    ) : (
                      claims.map((claim) => (
                        <div key={claim.id} className="rounded-3xl border border-[#d8e2ec] bg-white p-4">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <p className="font-semibold text-[#102a43]">₹{claim.claimAmount} - {claim.status}</p>
                            <p className="text-sm text-[#64748b]">{new Date(claim.submissionDate).toLocaleDateString()}</p>
                          </div>
                          <p className="mt-3 text-sm text-[#475569]">{claim.reason}</p>
                        </div>
                      ))
                    )}
                  </div>

                  <form className="mt-6 grid gap-4 rounded-3xl border border-[#d8e2ec] bg-white p-5" onSubmit={handleSubmitClaim}>
                    <p className="text-sm font-semibold text-[#102a43]">Submit a new claim</p>
                    <label className="grid gap-2">
                      <span className="text-sm text-[#334155]">Claim amount</span>
                      <input
                        className="h-11 rounded-md border border-[#cfdbe5] bg-[#f8fafc] px-3 text-sm text-[#15222f] outline-none focus:border-[#0f766e] focus:ring-4 focus:ring-[#a7f3d0]/45"
                        value={claimForm.claimAmount}
                        onChange={handleClaimChange("claimAmount")}
                        type="number"
                        placeholder="Enter claim amount"
                      />
                    </label>
                    <label className="grid gap-2">
                      <span className="text-sm text-[#334155]">Reason</span>
                      <textarea
                        className="min-h-25 rounded-md border border-[#cfdbe5] bg-[#f8fafc] px-3 py-2 text-sm text-[#15222f] outline-none focus:border-[#0f766e] focus:ring-4 focus:ring-[#a7f3d0]/45"
                        value={claimForm.reason}
                        onChange={handleClaimChange("reason")}
                        placeholder="Describe why you are filing a claim"
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={isSubmittingClaim}
                      className="h-11 rounded-md bg-[#0f766e] px-5 text-sm font-black text-white transition hover:bg-[#0b5f59]"
                    >
                      {isSubmittingClaim ? "Submitting claim..." : "Submit claim"}
                    </button>
                  </form>
                </div>
              )}

              {activeTab === "Premiums" && (
                <div className="rounded-3xl border border-[#eef2f7] bg-[#f8fbfd] p-6">
                  <p className="text-sm uppercase tracking-[0.18em] text-[#0f766e]">Premiums</p>
                  <div className="mt-4 space-y-4">
                    {premiumPayments.length === 0 ? (
                      <p className="text-sm leading-6 text-[#64748b]">No premium payments have been recorded yet.</p>
                    ) : (
                      premiumPayments.map((payment) => (
                        <div key={payment.id} className="rounded-3xl border border-[#d8e2ec] bg-white p-4">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <p className="font-semibold text-[#102a43]">₹{payment.amount} - {payment.paymentStatus}</p>
                            <p className="text-sm text-[#64748b]">{new Date(payment.paymentDate).toLocaleDateString()}</p>
                          </div>
                          <p className="mt-3 text-sm text-[#475569]">Method: {payment.paymentMethod}</p>
                        </div>
                      ))
                    )}
                  </div>

                  <form className="mt-6 grid gap-4 rounded-3xl border border-[#d8e2ec] bg-white p-5" onSubmit={handleSubmitPayment}>
                    <p className="text-sm font-semibold text-[#102a43]">Record a premium payment</p>
                    <label className="grid gap-2">
                      <span className="text-sm text-[#334155]">Amount</span>
                      <input
                        className="h-11 rounded-md border border-[#cfdbe5] bg-[#f8fafc] px-3 text-sm text-[#15222f] outline-none focus:border-[#0f766e] focus:ring-4 focus:ring-[#a7f3d0]/45"
                        value={paymentForm.amount}
                        onChange={handlePaymentChange("amount")}
                        type="number"
                        placeholder="Enter payment amount"
                      />
                    </label>
                    <label className="grid gap-2">
                      <span className="text-sm text-[#334155]">Payment method</span>
                      <select
                        className="h-11 rounded-md border border-[#cfdbe5] bg-[#f8fafc] px-3 text-sm text-[#15222f] outline-none focus:border-[#0f766e] focus:ring-4 focus:ring-[#a7f3d0]/45"
                        value={paymentForm.paymentMethod}
                        onChange={handlePaymentChange("paymentMethod")}
                      >
                        <option>Online</option>
                        <option>Bank transfer</option>
                        <option>Wallet</option>
                      </select>
                    </label>
                    <button
                      type="submit"
                      disabled={isSubmittingPayment}
                      className="h-11 rounded-md bg-[#0f766e] px-5 text-sm font-black text-white transition hover:bg-[#0b5f59]"
                    >
                      {isSubmittingPayment ? "Recording payment..." : "Record payment"}
                    </button>
                  </form>
                </div>
              )}

              {activeTab === "Documents" && (
                <div className="rounded-3xl border border-[#eef2f7] bg-[#f8fbfd] p-6">
                  <p className="text-sm uppercase tracking-[0.18em] text-[#0f766e]">Documents</p>
                  <div className="mt-4 space-y-4">
                    {documents.length === 0 ? (
                      <p className="text-sm leading-6 text-[#64748b]">No documents have been uploaded yet.</p>
                    ) : (
                      documents.map((document) => (
                        <div key={document.id} className="rounded-3xl border border-[#d8e2ec] bg-white p-4">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <p className="font-semibold text-[#102a43]">{document.fileName}</p>
                            <p className="text-sm text-[#64748b]">{new Date(document.uploadedAt).toLocaleDateString()}</p>
                          </div>
                          <p className="mt-3 text-sm text-[#475569]">Path: {document.filePath}</p>
                        </div>
                      ))
                    )}
                  </div>

                  <form className="mt-6 grid gap-4 rounded-3xl border border-[#d8e2ec] bg-white p-5" onSubmit={handleUploadDocument}>
                    <p className="text-sm font-semibold text-[#102a43]">Upload a document</p>
                    <label className="grid gap-2">
                      <span className="text-sm text-[#334155]">Document name</span>
                      <input
                        className="h-11 rounded-md border border-[#cfdbe5] bg-[#f8fafc] px-3 text-sm text-[#15222f] outline-none focus:border-[#0f766e] focus:ring-4 focus:ring-[#a7f3d0]/45"
                        value={documentForm.fileName}
                        onChange={handleDocumentChange("fileName")}
                        placeholder="Enter document name"
                      />
                    </label>
                    <label className="grid gap-2">
                      <span className="text-sm text-[#334155]">Document path</span>
                      <input
                        className="h-11 rounded-md border border-[#cfdbe5] bg-[#f8fafc] px-3 text-sm text-[#15222f] outline-none focus:border-[#0f766e] focus:ring-4 focus:ring-[#a7f3d0]/45"
                        value={documentForm.filePath}
                        onChange={handleDocumentChange("filePath")}
                        placeholder="Enter document path"
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={isUploadingDocument}
                      className="h-11 rounded-md bg-[#0f766e] px-5 text-sm font-black text-white transition hover:bg-[#0b5f59]"
                    >
                      {isUploadingDocument ? "Uploading document..." : "Upload document"}
                    </button>
                  </form>
                </div>
              )}

              {activeTab === "Support" && (
                <div className="rounded-3xl border border-[#eef2f7] bg-[#f8fbfd] p-6">
                  <p className="text-sm uppercase tracking-[0.18em] text-[#0f766e]">Support</p>
                  <div className="mt-4 space-y-4 rounded-3xl border border-[#d8e2ec] bg-white p-5">
                    <div>
                      <p className="text-sm font-semibold text-[#102a43]">Help center</p>
                      <p className="mt-2 text-sm leading-6 text-[#64748b]">
                        For policy, claims, or payment support, email our customer care team or give us a call.
                      </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-3xl border border-[#e2e8f0] bg-[#f8fafc] p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-[#718096]">Email</p>
                        <p className="mt-1 font-black text-[#102a43]">support@insurebook.com</p>
                      </div>
                      <div className="rounded-3xl border border-[#e2e8f0] bg-[#f8fafc] p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-[#718096]">Phone</p>
                        <p className="mt-1 font-black text-[#102a43]">+91 90000 12345</p>
                      </div>
                    </div>
                    <div className="rounded-3xl border border-[#e2e8f0] bg-[#f8fafc] p-4">
                      <p className="text-sm font-semibold text-[#102a43]">Quick guidance</p>
                      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[#64748b]">
                        <li>Submit a claim from the Claims tab.</li>
                        <li>Record payments from the Premiums tab.</li>
                        <li>Upload policy documents from the Documents tab.</li>
                      </ul>
                    </div>
                  </div>
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
