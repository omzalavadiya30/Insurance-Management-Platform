"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { ApiError, AuthSession, authApi, clearSession, getStoredSession, saveSession } from "@/lib/auth";
import {
  Customer,
  CustomerHistoryEvent,
  CustomerPayload,
  CustomerStatus,
  customerApi,
} from "@/lib/customer";

type FormState = {
  fullName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  address: string;
  identityType: string;
  identityNumber: string;
  status: CustomerStatus;
};

type FieldErrors = Partial<Record<keyof FormState | "form", string>>;
type FormMode = "create" | "edit" | "self";

const emptyForm: FormState = {
  fullName: "",
  email: "",
  phone: "",
  dateOfBirth: "",
  address: "",
  identityType: "Aadhaar",
  identityNumber: "",
  status: "active",
};

const namePattern = /^[A-Za-z][A-Za-z .'-]{1,79}$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^[0-9+\-\s()]{7,20}$/;

const toForm = (customer: Customer): FormState => ({
  fullName: customer.fullName || "",
  email: customer.email || "",
  phone: customer.phone || "",
  dateOfBirth: customer.dateOfBirth || "",
  address: customer.address || "",
  identityType: customer.identityType || "Aadhaar",
  identityNumber: customer.identityNumber || "",
  status: customer.status || "active",
});

const validateForm = (form: FormState, mode: FormMode) => {
  const errors: FieldErrors = {};

  if (!namePattern.test(form.fullName.trim())) {
    errors.fullName = "Use 2-80 letters, spaces, apostrophes, periods, or hyphens.";
  }

  if (mode !== "self" && !emailPattern.test(form.email.trim())) {
    errors.email = "Enter a valid email address.";
  }

  if (!phonePattern.test(form.phone.trim())) {
    errors.phone = "Use 7-20 digits, spaces, +, -, or parentheses.";
  }

  if (!form.dateOfBirth) {
    errors.dateOfBirth = "Date of birth is required.";
  } else {
    const parsedDate = new Date(`${form.dateOfBirth}T00:00:00`);

    if (
      Number.isNaN(parsedDate.getTime()) ||
      parsedDate.getTime() > Date.now()
    ) {
      errors.dateOfBirth = "Choose a valid date that is not in the future.";
    }
  }

  if (form.address.trim().length < 5) {
    errors.address = "Address must be at least 5 characters.";
  }

  if (mode !== "self") {
    if (form.identityType.trim().length < 2) {
      errors.identityType = "Identity type is required.";
    }

    if (form.identityNumber.trim().length < 3) {
      errors.identityNumber = "Identity number is required.";
    }
  }

  return errors;
};

const getFirstError = (errors: FieldErrors) =>
  Object.values(errors).find(Boolean) || "Please check the customer form.";

const mapApiErrors = (error: ApiError): FieldErrors => {
  if (!error.details?.length) {
    return { form: error.message };
  }

  return error.details.reduce<FieldErrors>((next, detail) => {
    const field = detail.field as keyof FormState;

    if (field in emptyForm) {
      next[field] = detail.message;
    } else {
      next.form = detail.message;
    }

    return next;
  }, {});
};

const formatDate = (value?: string | null) => {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString();
};

export default function CustomerManagementClient() {
  const router = useRouter();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [history, setHistory] = useState<CustomerHistoryEvent[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<CustomerStatus | "">("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [formMode, setFormMode] = useState<FormMode>("create");
  const [isLoading, setIsLoading] = useState(true);
  const [isListLoading, setIsListLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isManager = session?.user.role === "admin" || session?.user.role === "agent";
  const totalPages = Math.max(Math.ceil(total / 10), 1);

  const loadHistory = useCallback(
    async (token: string, customerId: string) => {
      const response = await customerApi.history(token, customerId);
      setHistory(response.data?.history || []);
    },
    []
  );

  const loadCustomers = useCallback(
    async (
      token: string,
      nextPage: number,
      nextSearch = "",
      nextStatus: CustomerStatus | "" = ""
    ) => {
      setIsListLoading(true);

      try {
        const response = await customerApi.list(token, {
          search: nextSearch,
          status: nextStatus || undefined,
          page: nextPage,
          limit: 10,
        });
        const data = response.data;

        setCustomers(data?.customers || []);
        setTotal(data?.total || 0);
        setPage(data?.page || nextPage);
        return data;
      } finally {
        setIsListLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    const storedSession = getStoredSession();

    if (!storedSession) {
      router.replace("/login");
      return;
    }

    const loadPage = async () => {
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
          router.replace("/profile");
          return;
        }

        const data = await loadCustomers(refreshedSession.token, 1);
        const firstCustomer = data?.customers?.[0];

        if (firstCustomer) {
          setSelectedCustomer(firstCustomer);
          setForm(toForm(firstCustomer));
          setFormMode("edit");
          await loadHistory(refreshedSession.token, firstCustomer.id);
        }
      } catch (error) {
        clearSession();
        toast.error(error instanceof Error ? error.message : "Please log in again.");
        router.replace("/login");
      } finally {
        setIsLoading(false);
      }
    };

    loadPage();
  }, [loadCustomers, loadHistory, router]);

  const updateField =
    (field: keyof FormState) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const value = event.target.value;

      setForm((current) => ({ ...current, [field]: value }));
      setFieldErrors((current) => {
        if (!current[field]) {
          return current;
        }

        const next = { ...current };
        delete next[field];
        return next;
      });
    };

  const fieldClass = (field: keyof FormState) =>
    `min-h-10 w-full rounded-md border bg-white px-3 py-2 text-sm outline-none transition ${
      fieldErrors[field]
        ? "border-[#d65c3a] focus:border-[#d65c3a] focus:ring-4 focus:ring-[#ffd6cc]"
        : "border-[#cfdbe5] focus:border-[#0f766e] focus:ring-4 focus:ring-[#a7f3d0]/45"
    }`;

  const fieldMessage = (field: keyof FormState) =>
    fieldErrors[field] ? (
      <p className="mt-1 text-xs font-semibold text-[#b23b21]">
        {fieldErrors[field]}
      </p>
    ) : null;

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!session) {
      return;
    }

    await loadCustomers(session.token, 1, search, status);
  };

  const handleSelectCustomer = async (customer: Customer) => {
    if (!session) {
      return;
    }

    setSelectedCustomer(customer);
    setForm(toForm(customer));
    setFormMode("edit");
    setFieldErrors({});

    const toastId = toast.loading("Loading customer history...");

    try {
      await loadHistory(session.token, customer.id);
      toast.success("Customer loaded.", { id: toastId });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load history.", {
        id: toastId,
      });
    }
  };

  const handleNewCustomer = () => {
    setSelectedCustomer(null);
    setHistory([]);
    setForm(emptyForm);
    setFormMode("create");
    setFieldErrors({});
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!session) {
      return;
    }

    const errors = validateForm(form, formMode);

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      toast.error(getFirstError(errors));
      return;
    }

    setIsSubmitting(true);
    setFieldErrors({});
    const toastId = toast.loading(
      formMode === "create" ? "Registering customer..." : "Saving customer..."
    );

    try {
      if (formMode === "self") {
        const response = await customerApi.updateMe(session.token, {
          fullName: form.fullName.trim(),
          phone: form.phone.trim(),
          dateOfBirth: form.dateOfBirth,
          address: form.address.trim(),
        });
        const customer = response.data?.customer || null;

        setSelectedCustomer(customer);

        if (customer) {
          setForm(toForm(customer));
          await loadHistory(session.token, customer.id);
        }

        toast.success("Profile updated successfully.", { id: toastId });
        return;
      }

      const payload: CustomerPayload = {
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        dateOfBirth: form.dateOfBirth,
        address: form.address.trim(),
        identityType: form.identityType.trim(),
        identityNumber: form.identityNumber.trim(),
        status: form.status,
      };

      if (formMode === "create") {
        const response = await customerApi.create(session.token, payload);
        const customer = response.data?.customer || null;

        toast.success("Customer registered successfully.", { id: toastId });

        if (customer) {
          setSelectedCustomer(customer);
          setForm(toForm(customer));
          setFormMode("edit");
          await loadHistory(session.token, customer.id);
        }

        await loadCustomers(session.token, 1, search, status);
      } else if (selectedCustomer) {
        const response = await customerApi.update(
          session.token,
          selectedCustomer.id,
          payload
        );
        const customer = response.data?.customer || null;

        toast.success("Customer updated successfully.", { id: toastId });

        if (customer) {
          setSelectedCustomer(customer);
          setForm(toForm(customer));
          await loadHistory(session.token, customer.id);
        }

        await loadCustomers(session.token, page, search, status);
      }
    } catch (error) {
      if (error instanceof ApiError) {
        setFieldErrors(mapApiErrors(error));
      }

      toast.error(error instanceof Error ? error.message : "Unable to save customer.", {
        id: toastId,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const historyToneClass = (tone: CustomerHistoryEvent["tone"]) => {
    if (tone === "success") return "border-[#9fd7c9] bg-[#effbf7] text-[#0f5f58]";
    if (tone === "warning") return "border-[#efd094] bg-[#fff8e8] text-[#8a5a10]";
    return "border-[#cfdbe5] bg-[#f8fafc] text-[#17313d]";
  };

  const selectedSummary = useMemo(() => {
    if (!selectedCustomer) {
      return "No customer selected";
    }

    return `${selectedCustomer.customerCode || "Customer"} - ${selectedCustomer.status}`;
  }, [selectedCustomer]);

  if (isLoading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#eef3f6] px-5 text-[#15222f]">
        <div className="rounded-lg border border-[#dfe7ef] bg-white px-8 py-6 text-center shadow-[0_18px_45px_rgba(21,34,47,0.12)]">
          <p className="text-sm font-black uppercase tracking-[0.18em] text-[#0f766e]">
            Loading customers
          </p>
          <p className="mt-3 text-sm text-[#667987]">
            Preparing the customer management workspace.
          </p>
        </div>
      </main>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <main className="min-h-screen bg-[#eef3f6] text-[#15222f]">
      <header className="border-b border-[#d6e1ea] bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#bd6230]">
              Admin / Agent CRM workspace
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="mt-2 text-2xl font-black text-[#102a43]">
                Customer Management
              </h1>
              <span className="rounded-full border border-[#cbd5e1] bg-[#f8fafc] px-3 py-1 text-xs font-black uppercase text-[#0f766e]">
                {isManager ? "Admin / Agent Access" : "Restricted"}
              </span>
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#64748b]">
              Only admin and agent roles can manage customer records, search customer information, and update customer profiles. Customers are redirected to their own dashboard.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              className="grid h-10 place-items-center rounded-md border border-[#cfdbe5] bg-white px-4 text-sm font-black text-[#17313d] transition hover:border-[#0f766e] hover:text-[#0f766e]"
              href="/dashboard"
            >
              Dashboard
            </Link>
            {isManager && (
              <button
                className="h-10 rounded-md bg-[#0f766e] px-4 text-sm font-black text-white transition hover:bg-[#0b5f59]"
                onClick={handleNewCustomer}
                type="button"
              >
                New Customer
              </button>
            )}
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-5 px-5 py-6 lg:grid-cols-[390px_minmax(0,1fr)]">
        {isManager ? (
          <aside className="space-y-4">
            <form
              className="rounded-lg border border-[#dfe7ef] bg-white p-4 shadow-[0_14px_35px_rgba(21,34,47,0.08)]"
              onSubmit={handleSearch}
            >
              <p className="text-sm font-black uppercase tracking-[0.16em] text-[#0f766e]">
                Search Customers
              </p>
              <div className="mt-4 grid gap-3">
                <input
                  className="h-10 rounded-md border border-[#cfdbe5] px-3 text-sm outline-none focus:border-[#0f766e] focus:ring-4 focus:ring-[#a7f3d0]/45"
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Name, email, phone, or code"
                  value={search}
                />
                <select
                  className="h-10 rounded-md border border-[#cfdbe5] px-3 text-sm outline-none focus:border-[#0f766e] focus:ring-4 focus:ring-[#a7f3d0]/45"
                  onChange={(event) => setStatus(event.target.value as CustomerStatus | "")}
                  value={status}
                >
                  <option value="">All statuses</option>
                  <option value="active">Active</option>
                  <option value="disabled">Disabled</option>
                </select>
                <button
                  className="h-10 rounded-md bg-[#12333d] px-4 text-sm font-black text-white"
                  disabled={isListLoading}
                  type="submit"
                >
                  {isListLoading ? "Searching..." : "Search"}
                </button>
              </div>
            </form>

            <div className="rounded-lg border border-[#dfe7ef] bg-white shadow-[0_14px_35px_rgba(21,34,47,0.08)]">
              <div className="flex items-center justify-between border-b border-[#edf1f5] px-4 py-3">
                <p className="text-sm font-black text-[#102a43]">
                  Customers
                </p>
                <span className="rounded-md bg-[#effbf7] px-2.5 py-1 text-xs font-black text-[#0f5f58]">
                  {total} total
                </span>
              </div>

              <div className="max-h-130 overflow-auto">
                {customers.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-[#667987]">
                    No customers found.
                  </div>
                ) : (
                  customers.map((customer) => (
                    <button
                      className={`block w-full border-b border-[#edf1f5] px-4 py-3 text-left transition hover:bg-[#f8fafc] ${
                        selectedCustomer?.id === customer.id ? "bg-[#effbf7]" : "bg-white"
                      }`}
                      key={customer.id}
                      onClick={() => handleSelectCustomer(customer)}
                      type="button"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-black text-[#102a43]">
                            {customer.fullName}
                          </p>
                          <p className="mt-1 text-sm text-[#5e7180]">
                            {customer.email}
                          </p>
                        </div>
                        <span className="rounded-md bg-white px-2 py-1 text-xs font-black uppercase text-[#0f766e]">
                          {customer.status}
                        </span>
                      </div>
                      <p className="mt-2 text-xs font-bold uppercase tracking-[0.14em] text-[#8a9aaa]">
                        {customer.customerCode || customer.phone || "Customer"}
                      </p>
                    </button>
                  ))
                )}
              </div>

              <div className="flex items-center justify-between px-4 py-3">
                <button
                  className="h-9 rounded-md border border-[#cfdbe5] px-3 text-sm font-black disabled:opacity-40"
                  disabled={page <= 1 || isListLoading}
                  onClick={() =>
                    session && loadCustomers(session.token, page - 1, search, status)
                  }
                  type="button"
                >
                  Previous
                </button>
                <span className="text-sm font-bold text-[#667987]">
                  Page {page} of {totalPages}
                </span>
                <button
                  className="h-9 rounded-md border border-[#cfdbe5] px-3 text-sm font-black disabled:opacity-40"
                  disabled={page >= totalPages || isListLoading}
                  onClick={() =>
                    session && loadCustomers(session.token, page + 1, search, status)
                  }
                  type="button"
                >
                  Next
                </button>
              </div>
            </div>
          </aside>
        ) : (
          <aside className="rounded-lg border border-[#dfe7ef] bg-white p-5 shadow-[0_14px_35px_rgba(21,34,47,0.08)]">
            <p className="text-sm font-black uppercase tracking-[0.16em] text-[#0f766e]">
              My Profile
            </p>
            <p className="mt-3 text-sm leading-6 text-[#667987]">
              Customer accounts can view and maintain their own profile. Admins
              and agents manage the full customer registry.
            </p>
          </aside>
        )}

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="rounded-lg border border-[#dfe7ef] bg-white p-5 shadow-[0_14px_35px_rgba(21,34,47,0.08)]">
            <div className="flex flex-col gap-2 border-b border-[#edf1f5] pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[#bd6230]">
                  {formMode === "create" ? "Register Customer" : "Customer Profile"}
                </p>
                <h2 className="mt-2 text-xl font-black text-[#102a43]">
                  {formMode === "create"
                    ? "Add a new customer"
                    : selectedCustomer?.fullName || "Your customer profile"}
                </h2>
              </div>
              <span className="w-fit rounded-md bg-[#f8fafc] px-3 py-2 text-sm font-black text-[#17313d]">
                {selectedSummary}
              </span>
            </div>

            {fieldErrors.form && (
              <div className="mt-4 rounded-md border border-[#f3b8a9] bg-[#fff4f0] px-4 py-3 text-sm font-semibold text-[#a23b24]">
                {fieldErrors.form}
              </div>
            )}

            <form className="mt-5 grid gap-4" onSubmit={handleSubmit}>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-black text-[#263f4d]">
                    Full name
                  </span>
                  <input
                    className={fieldClass("fullName")}
                    onChange={updateField("fullName")}
                    placeholder="Aarav Mehta"
                    value={form.fullName}
                  />
                  {fieldMessage("fullName")}
                </label>

                {formMode !== "self" && (
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-black text-[#263f4d]">
                      Email address
                    </span>
                    <input
                      className={fieldClass("email")}
                      onChange={updateField("email")}
                      placeholder="customer@example.com"
                      type="email"
                      value={form.email}
                    />
                    {fieldMessage("email")}
                  </label>
                )}

                <label className="block">
                  <span className="mb-1.5 block text-sm font-black text-[#263f4d]">
                    Phone
                  </span>
                  <input
                    className={fieldClass("phone")}
                    onChange={updateField("phone")}
                    placeholder="+91 98765 43210"
                    value={form.phone}
                  />
                  {fieldMessage("phone")}
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-sm font-black text-[#263f4d]">
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

                {formMode !== "self" && (
                  <>
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-black text-[#263f4d]">
                        Identity type
                      </span>
                      <input
                        className={fieldClass("identityType")}
                        onChange={updateField("identityType")}
                        placeholder="Aadhaar, PAN, Passport"
                        value={form.identityType}
                      />
                      {fieldMessage("identityType")}
                    </label>

                    <label className="block">
                      <span className="mb-1.5 block text-sm font-black text-[#263f4d]">
                        Identity number
                      </span>
                      <input
                        className={fieldClass("identityNumber")}
                        onChange={updateField("identityNumber")}
                        placeholder="Identity number"
                        value={form.identityNumber}
                      />
                      {fieldMessage("identityNumber")}
                    </label>
                  </>
                )}

                {formMode !== "self" && (
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-black text-[#263f4d]">
                      Status
                    </span>
                    <select
                      className={fieldClass("status")}
                      onChange={updateField("status")}
                      value={form.status}
                    >
                      <option value="active">Active</option>
                      <option value="disabled">Disabled</option>
                    </select>
                  </label>
                )}
              </div>

              <label className="block">
                <span className="mb-1.5 block text-sm font-black text-[#263f4d]">
                  Address
                </span>
                <textarea
                  className={`${fieldClass("address")} min-h-24 resize-y`}
                  onChange={updateField("address")}
                  placeholder="House, street, city, state"
                  value={form.address}
                />
                {fieldMessage("address")}
              </label>

              <div className="flex flex-wrap gap-2">
                <button
                  className="h-10 rounded-md bg-[#0f766e] px-5 text-sm font-black text-white transition hover:bg-[#0b5f59] disabled:opacity-60"
                  disabled={isSubmitting}
                  type="submit"
                >
                  {isSubmitting
                    ? "Saving..."
                    : formMode === "create"
                      ? "Register Customer"
                      : "Save Changes"}
                </button>
                {isManager && formMode === "edit" && (
                  <button
                    className="h-10 rounded-md border border-[#cfdbe5] px-5 text-sm font-black text-[#17313d]"
                    onClick={handleNewCustomer}
                    type="button"
                  >
                    Clear Form
                  </button>
                )}
              </div>
            </form>
          </section>

          <aside className="rounded-lg border border-[#dfe7ef] bg-white p-5 shadow-[0_14px_35px_rgba(21,34,47,0.08)]">
            <div className="border-b border-[#edf1f5] pb-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#0f766e]">
                Customer History
              </p>
              <h2 className="mt-2 text-xl font-black text-[#102a43]">
                Activity Timeline
              </h2>
            </div>

            {selectedCustomer ? (
              <div className="mt-4">
                <div className="rounded-md border border-[#edf1f5] bg-[#f8fafc] p-3">
                  <p className="font-black text-[#102a43]">
                    {selectedCustomer.fullName}
                  </p>
                  <p className="mt-1 text-sm text-[#667987]">
                    Joined {formatDate(selectedCustomer.createdAt)}
                  </p>
                </div>

                <div className="mt-4 space-y-3">
                  {history.length === 0 ? (
                    <p className="rounded-md border border-[#edf1f5] p-4 text-sm text-[#667987]">
                      No history available yet.
                    </p>
                  ) : (
                    history.map((event) => (
                      <article
                        className={`rounded-md border p-3 ${historyToneClass(event.tone)}`}
                        key={event.id}
                      >
                        <p className="text-sm font-black">{event.title}</p>
                        <p className="mt-1 text-sm leading-5">{event.description}</p>
                        <p className="mt-2 text-xs font-black uppercase tracking-[0.14em]">
                          {formatDate(event.happenedAt)}
                        </p>
                      </article>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <p className="mt-4 rounded-md border border-[#edf1f5] p-4 text-sm text-[#667987]">
                Select a customer or register a new one to view profile history.
              </p>
            )}
          </aside>
        </div>
      </section>
    </main>
  );
}
