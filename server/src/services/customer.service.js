const storage = require("../config/storage");
const HttpError = require("../utils/http-error");

const managerRoles = new Set(["admin", "agent"]);

const normalizeEmail = (email) => email.trim().toLowerCase();

const sanitizeCustomer = (customer) => {
  if (!customer) {
    return null;
  }

  return {
    id: customer.id,
    userId: customer.userId,
    createdBy: customer.createdBy,
    customerCode: customer.customerCode,
    fullName: customer.fullName,
    email: customer.email,
    phone: customer.phone,
    dateOfBirth: customer.dateOfBirth,
    address: customer.address,
    identityType: customer.identityType,
    identityNumber: customer.identityNumber,
    status: customer.status,
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
  };
};

const buildCustomerDashboard = ({
  customer,
  policies,
  claims,
  documents,
  premiumPayments,
}) => ({
  customer: sanitizeCustomer(customer),
  policies,
  claims,
  documents,
  premiumPayments,
});

const ensureManager = (actor) => {
  if (!managerRoles.has(actor.role)) {
    throw new HttpError(403, "Only administrators and insurance agents can manage customers.");
  }
};

const ensureCustomerAccess = async ({ actor, customer }) => {
  if (managerRoles.has(actor.role)) {
    return;
  }

  if (actor.role !== "customer") {
    throw new HttpError(403, "You do not have permission to access this customer.");
  }

  const ownCustomer = await storage.findCustomerByUserId(actor.id);

  if (!ownCustomer || ownCustomer.id !== customer.id) {
    throw new HttpError(403, "You can only access your own customer profile.");
  }
};

const ensureCustomerProfile = async (actor) => {
  if (actor.role !== "customer") {
    throw new HttpError(403, "This endpoint is only for customer accounts.");
  }

  let customer = await storage.findCustomerByUserId(actor.id);

  if (!customer) {
    customer = await storage.createCustomerProfile({
      userId: actor.id,
      fullName: actor.fullName,
      email: actor.email,
      phone: null,
      dateOfBirth: null,
      address: null,
      identityType: null,
      identityNumber: null,
      status: "active",
    });

    await storage.recordAuditLog({
      actorUserId: actor.id,
      action: "customer.auto_create",
      entityType: "customer",
      entityId: customer.id,
      metadata: { reason: "Customer profile created after login" },
    });
  }

  return customer;
};

const createHistoryEvent = ({ type, title, description, happenedAt, tone = "info" }) => ({
  id: `${type}-${happenedAt}-${title}`.replace(/\s+/g, "-").toLowerCase(),
  type,
  title,
  description,
  happenedAt,
  tone,
});

const buildCustomerHistory = ({
  customer,
  policies = [],
  claims = [],
  documents = [],
  premiumPayments = [],
}) => {
  const events = [
    createHistoryEvent({
      type: "profile",
      title: "Customer registered",
      description: `${customer.fullName} was added to the customer registry.`,
      happenedAt: customer.createdAt,
      tone: "success",
    }),
  ];

  if (customer.updatedAt && customer.updatedAt !== customer.createdAt) {
    events.push(
      createHistoryEvent({
        type: "profile",
        title: "Customer profile updated",
        description: "Customer contact or identity details were updated.",
        happenedAt: customer.updatedAt,
      })
    );
  }

  policies.forEach((policy) => {
    events.push(
      createHistoryEvent({
        type: "policy",
        title: `Policy ${policy.policyNumber || "created"}`,
        description: `${policy.policyType || "Insurance"} policy is ${policy.status}.`,
        happenedAt: policy.createdAt || policy.startDate || customer.createdAt,
        tone: policy.status === "active" ? "success" : "info",
      })
    );
  });

  claims.forEach((claim) => {
    events.push(
      createHistoryEvent({
        type: "claim",
        title: `Claim ${claim.status}`,
        description: `${claim.reason || "Claim request"} for Rs ${claim.claimAmount}.`,
        happenedAt: claim.submissionDate || claim.createdAt || customer.createdAt,
        tone: claim.status === "approved" ? "success" : "warning",
      })
    );
  });

  premiumPayments.forEach((payment) => {
    events.push(
      createHistoryEvent({
        type: "payment",
        title: `Premium ${payment.paymentStatus}`,
        description: `${payment.paymentMethod || "Payment"} of Rs ${payment.amount}.`,
        happenedAt: payment.paymentDate || payment.createdAt || customer.createdAt,
        tone: payment.paymentStatus === "paid" ? "success" : "warning",
      })
    );
  });

  documents.forEach((document) => {
    events.push(
      createHistoryEvent({
        type: "document",
        title: "Document uploaded",
        description: document.fileName,
        happenedAt: document.uploadedAt || document.createdAt || customer.createdAt,
      })
    );
  });

  return events.sort(
    (left, right) => new Date(right.happenedAt).getTime() - new Date(left.happenedAt).getTime()
  );
};

const listCustomerProfiles = async ({ actor, search, status, page, limit }) => {
  ensureManager(actor);

  const result = await storage.listCustomers({ search, status, page, limit });

  return {
    ...result,
    customers: result.customers.map(sanitizeCustomer),
  };
};

const createManagedCustomer = async ({
  actor,
  fullName,
  email,
  phone,
  dateOfBirth,
  address,
  identityType,
  identityNumber,
  status = "active",
}) => {
  ensureManager(actor);

  const normalizedEmail = normalizeEmail(email);
  const existingCustomer = await storage.findCustomerByEmail(normalizedEmail);

  if (existingCustomer) {
    throw new HttpError(409, "A customer with this email already exists.");
  }

  const customer = await storage.createCustomerProfile({
    createdBy: actor.id,
    fullName: fullName.trim(),
    email: normalizedEmail,
    phone: phone.trim(),
    dateOfBirth,
    address: address.trim(),
    identityType: identityType || null,
    identityNumber: identityNumber || null,
    status,
  });

  await storage.recordAuditLog({
    actorUserId: actor.id,
    action: "customer.create",
    entityType: "customer",
    entityId: customer.id,
    metadata: { customerCode: customer.customerCode },
  });

  return { customer: sanitizeCustomer(customer) };
};

const getCustomerProfile = async ({ actor, customerId }) => {
  const customer = await storage.findCustomerById(customerId);

  if (!customer) {
    throw new HttpError(404, "Customer not found.");
  }

  await ensureCustomerAccess({ actor, customer });

  return { customer: sanitizeCustomer(customer) };
};

const updateCustomerProfile = async ({ actor, customerId, patch }) => {
  ensureManager(actor);

  const existingCustomer = await storage.findCustomerById(customerId);

  if (!existingCustomer) {
    throw new HttpError(404, "Customer not found.");
  }

  if (patch.email) {
    const emailOwner = await storage.findCustomerByEmail(normalizeEmail(patch.email));

    if (emailOwner && emailOwner.id !== customerId) {
      throw new HttpError(409, "Another customer already uses this email.");
    }
  }

  const updatedCustomer = await storage.updateCustomerProfile(customerId, {
    ...patch,
    fullName: patch.fullName?.trim(),
    email: patch.email ? normalizeEmail(patch.email) : undefined,
    phone: patch.phone?.trim(),
    address: patch.address?.trim(),
    identityType: patch.identityType?.trim(),
    identityNumber: patch.identityNumber?.trim(),
  });

  if (!updatedCustomer) {
    throw new HttpError(404, "Customer not found.");
  }

  await storage.recordAuditLog({
    actorUserId: actor.id,
    action: "customer.update",
    entityType: "customer",
    entityId: customerId,
    metadata: { changedFields: Object.keys(patch) },
  });

  return { customer: sanitizeCustomer(updatedCustomer) };
};

const getOwnCustomerProfile = async ({ actor }) => {
  const customer = await ensureCustomerProfile(actor);
  return { customer: sanitizeCustomer(customer) };
};

const updateOwnCustomerProfile = async ({ actor, patch }) => {
  const customer = await ensureCustomerProfile(actor);

  const updatedCustomer = await storage.updateCustomerProfile(customer.id, {
    fullName: patch.fullName?.trim(),
    phone: patch.phone?.trim(),
    dateOfBirth: patch.dateOfBirth,
    address: patch.address?.trim(),
  });

  await storage.recordAuditLog({
    actorUserId: actor.id,
    action: "customer.self_update",
    entityType: "customer",
    entityId: customer.id,
    metadata: { changedFields: Object.keys(patch) },
  });

  return { customer: sanitizeCustomer(updatedCustomer) };
};

const getCustomerHistory = async ({ actor, customerId }) => {
  const customer = await storage.findCustomerById(customerId);

  if (!customer) {
    throw new HttpError(404, "Customer not found.");
  }

  await ensureCustomerAccess({ actor, customer });

  const policies = await storage.findPoliciesByCustomerId(customer.id);
  const claims = await storage.findClaimsByCustomerId(customer.id);
  const documents = await storage.findDocumentsByCustomerId(customer.id);
  const premiumPayments = await storage.findPremiumPaymentsByCustomerId(customer.id);

  return {
    customer: sanitizeCustomer(customer),
    history: buildCustomerHistory({
      customer,
      policies,
      claims,
      documents,
      premiumPayments,
    }),
  };
};

const registerCustomerProfile = async ({
  userId,
  fullName,
  email,
  phone,
  dateOfBirth,
  address,
  identityType,
  identityNumber,
}) => {
  const existingCustomer = await storage.findCustomerByUserId(userId);

  if (existingCustomer) {
    return getCustomerDashboard({ userId });
  }

  const customer = await storage.createCustomerProfile({
    userId,
    fullName,
    email,
    phone,
    dateOfBirth,
    address,
    identityType,
    identityNumber,
  });

  const policy = await storage.createPolicy({
    customerId: customer.id,
    policyType: "health",
    policyNumber: `POL-${Date.now().toString(36).toUpperCase()}`,
    premiumAmount: 2500,
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10),
    status: "active",
  });

  const document = await storage.createDocument({
    customerId: customer.id,
    fileName: `${identityType || "identity"}-proof.pdf`,
    filePath: `/documents/${customer.id}/${identityType || "identity"}-proof.pdf`,
    uploadedAt: new Date().toISOString(),
  });

  return buildCustomerDashboard({
    customer,
    policies: [policy],
    claims: [],
    documents: [document],
    premiumPayments: [],
  });
};

const getCustomerDashboard = async ({ userId }) => {
  const customer = await storage.findCustomerByUserId(userId);

  if (!customer) {
    return null;
  }

  const policies = await storage.findPoliciesByCustomerId(customer.id);
  const claims = await storage.findClaimsByCustomerId(customer.id);
  const documents = await storage.findDocumentsByCustomerId(customer.id);
  const premiumPayments = await storage.findPremiumPaymentsByCustomerId(customer.id);

  return buildCustomerDashboard({
    customer,
    policies,
    claims,
    documents,
    premiumPayments,
  });
};

const createCustomerClaim = async ({ userId, claimAmount, reason }) => {
  const customer = await storage.findCustomerByUserId(userId);

  if (!customer) {
    throw new HttpError(404, "Customer profile not found.");
  }

  const policy = await storage.findActivePolicyByCustomerId(customer.id);

  if (!policy) {
    throw new HttpError(404, "No active policy found for this customer.");
  }

  await storage.createClaim({
    policyId: policy.id,
    claimAmount,
    reason,
    status: "submitted",
  });

  return getCustomerDashboard({ userId });
};

const recordPremiumPayment = async ({ userId, amount, paymentMethod }) => {
  const customer = await storage.findCustomerByUserId(userId);

  if (!customer) {
    throw new HttpError(404, "Customer profile not found.");
  }

  const policy = await storage.findActivePolicyByCustomerId(customer.id);

  await storage.createPremiumPayment({
    customerId: customer.id,
    policyId: policy?.id || null,
    amount,
    paymentMethod,
  });

  return getCustomerDashboard({ userId });
};

const uploadCustomerDocument = async ({ userId, fileName, filePath }) => {
  const customer = await storage.findCustomerByUserId(userId);

  if (!customer) {
    throw new HttpError(404, "Customer profile not found.");
  }

  await storage.createDocument({
    customerId: customer.id,
    fileName,
    filePath,
    uploadedAt: new Date().toISOString(),
  });

  return getCustomerDashboard({ userId });
};

const getPoliciesByCustomerId = async (customerId) => {
  return storage.findPoliciesByCustomerId(customerId);
};

const getCustomerPayments = async ({ actor, customerId }) => {
  const customer = await storage.findCustomerById(customerId);

  if (!customer) {
    throw new HttpError(404, "Customer not found.");
  }

  await ensureCustomerAccess({ actor, customer });

  const premiumPayments = await storage.findPremiumPaymentsByCustomerId(customer.id);
  return { premiumPayments };
};

const getOwnPremiumPayments = async ({ actor }) => {
  const customer = await storage.findCustomerByUserId(actor.id);

  if (!customer) {
    throw new HttpError(404, "Customer profile not found.");
  }

  const premiumPayments = await storage.findPremiumPaymentsByCustomerId(customer.id);
  return { premiumPayments };
};

const getCustomerPolicies = async ({ actor, customerId }) => {
  const customer = await storage.findCustomerById(customerId);

  if (!customer) {
    throw new HttpError(404, "Customer not found.");
  }

  await ensureCustomerAccess({ actor, customer });

  const policies = await storage.findPoliciesByCustomerId(customer.id);
  return { policies };
};

const createPolicyForCustomer = async ({
  actor,
  customerId,
  policyType,
  premiumAmount,
  startDate,
  endDate,
  status = "active",
}) => {
  ensureManager(actor);

  const customer = await storage.findCustomerById(customerId);

  if (!customer) {
    throw new HttpError(404, "Customer not found.");
  }

  const policy = await storage.createPolicy({
    customerId: customer.id,
    policyType,
    policyNumber: `POL-${Date.now().toString(36).toUpperCase()}`,
    premiumAmount,
    startDate,
    endDate,
    status,
  });

  await storage.recordAuditLog({
    actorUserId: actor.id,
    action: "policy.create",
    entityType: "policy",
    entityId: policy.id,
    metadata: {
      customerId: customer.id,
      policyNumber: policy.policyNumber,
      policyType: policy.policyType,
    },
  });

  return { policy };
};

module.exports = {
  createCustomerClaim,
  createManagedCustomer,
  createPolicyForCustomer,
  ensureCustomerProfile,
  getCustomerDashboard,
  getCustomerHistory,
  getCustomerPayments,
  getCustomerPolicies,
  getCustomerProfile,
  getOwnCustomerProfile,
  getOwnPremiumPayments,
  getPoliciesByCustomerId,
  listCustomerProfiles,
  recordPremiumPayment,
  registerCustomerProfile,
  sanitizeCustomer,
  updateCustomerProfile,
  updateOwnCustomerProfile,
  uploadCustomerDocument,
};
