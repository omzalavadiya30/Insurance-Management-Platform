const { randomUUID } = require("crypto");
const env = require("./env");
const supabase = require("./supabase");

const createId = () => {
  try {
    return randomUUID();
  } catch {
    return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }
};

const ensureUuid = (value) => {
  if (!value) {
    return createId();
  }

  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (uuidPattern.test(value)) {
    return value;
  }

  return createId();
};

const state = {
  users: [],
  customers: [],
  policies: [],
  claims: [],
  documents: [],
  premiumPayments: [],
  sessions: [],
  passwordResetTokens: [],
  auditLogs: [],
};

const toUserRecord = (user) => ({
  ...user,
  createdAt: user.createdAt || new Date().toISOString(),
  updatedAt: user.updatedAt || new Date().toISOString(),
});

const useSupabase =
  env.nodeEnv !== "test" &&
  Boolean(env.supabaseUrl && env.supabaseServiceRoleKey && supabase);

const logSupabaseFallback = (message, error) => {
  if (process.env.SUPABASE_DEBUG === "true") {
    console.warn(message, error.message);
  }
};

const normalizeAppUser = (row) => ({
  id: row.id,
  fullName: row.fullName || row.name || row.full_name || "",
  email: row.email,
  passwordHash: row.passwordHash || row.password || null,
  role: row.role,
  status: row.status,
  createdAt: row.createdAt || row.created_at || new Date().toISOString(),
  updatedAt: row.updatedAt || row.updated_at || new Date().toISOString(),
});

const normalizeCustomer = (row) => ({
  id: row.id,
  userId: row.userId || row.user_id || null,
  createdBy: row.createdBy || row.created_by || null,
  customerCode: row.customerCode || row.customer_code || null,
  fullName: row.fullName || row.name || row.full_name || "",
  email: row.email,
  phone: row.phone || null,
  dateOfBirth: row.dateOfBirth || row.dob || row.date_of_birth || null,
  address: row.address || null,
  identityType: row.identityType || row.identity_type || null,
  identityNumber: row.identityNumber || row.identity_number || null,
  status: row.status || "active",
  createdAt: row.createdAt || row.created_at || new Date().toISOString(),
  updatedAt: row.updatedAt || row.updated_at || new Date().toISOString(),
});

const normalizePolicy = (row) => ({
  id: row.id,
  customerId: row.customerId || row.customer_id || null,
  policyType: row.policyType || row.policy_type || null,
  policyNumber: row.policyNumber || row.policy_number || null,
  premiumAmount: row.premiumAmount || row.premium_amount || 0,
  startDate: row.startDate || row.start_date || null,
  endDate: row.endDate || row.end_date || null,
  status: row.status,
  createdAt: row.createdAt || row.created_at || new Date().toISOString(),
  updatedAt: row.updatedAt || row.updated_at || new Date().toISOString(),
});

const normalizeClaim = (row) => ({
  id: row.id,
  policyId: row.policyId || row.policy_id || null,
  claimAmount: row.claimAmount || row.claim_amount || 0,
  reason: row.reason || "",
  status: row.status,
  submissionDate: row.submissionDate || row.submission_date || null,
  createdAt: row.createdAt || row.created_at || new Date().toISOString(),
  updatedAt: row.updatedAt || row.updated_at || new Date().toISOString(),
});

const normalizeDocument = (row) => ({
  id: row.id,
  customerId: row.customerId || row.customer_id || null,
  fileName: row.fileName || row.file_name || null,
  filePath: row.filePath || row.file_path || null,
  uploadedAt: row.uploadedAt || row.uploaded_at || null,
  createdAt: row.createdAt || row.created_at || new Date().toISOString(),
  updatedAt: row.updatedAt || row.updated_at || new Date().toISOString(),
});

const normalizePremiumPayment = (row) => ({
  id: row.id,
  customerId: row.customerId || row.customer_id || null,
  policyId: row.policyId || row.policy_id || null,
  amount: row.amount || row.amount || 0,
  paymentMethod: row.paymentMethod || row.payment_method || null,
  paymentStatus: row.paymentStatus || row.payment_status || "paid",
  paymentDate: row.paymentDate || row.payment_date || null,
  createdAt: row.createdAt || row.created_at || new Date().toISOString(),
  updatedAt: row.updatedAt || row.updated_at || new Date().toISOString(),
});

const normalizeSession = (row) => ({
  id: row.id,
  userId: row.userId || row.user_id || null,
  jwtId: row.jwtId || row.jwt_id || null,
  tokenHash: row.tokenHash || row.token_hash || null,
  expiresAt: row.expiresAt || row.expires_at || null,
  revokedAt: row.revokedAt || row.revoked_at || null,
  lastSeenAt: row.lastSeenAt || row.last_seen_at || null,
  ipAddress: row.ipAddress || row.ip_address || null,
  userAgent: row.userAgent || row.user_agent || null,
  createdAt: row.createdAt || row.created_at || new Date().toISOString(),
});

const normalizeResetToken = (row) => ({
  id: row.id,
  userId: row.userId || row.user_id || null,
  tokenHash: row.tokenHash || row.token_hash || null,
  expiresAt: row.expiresAt || row.expires_at || null,
  usedAt: row.usedAt || row.used_at || null,
  createdAt: row.createdAt || row.created_at || new Date().toISOString(),
});

const normalizeAuditLog = (row) => ({
  id: row.id,
  actorUserId: row.actorUserId || row.actor_user_id || null,
  action: row.action,
  entityType: row.entityType || row.entity_type || null,
  entityId: row.entityId || row.entity_id || null,
  metadata: row.metadata || {},
  createdAt: row.createdAt || row.created_at || new Date().toISOString(),
});

const createUser = ({ fullName, email, passwordHash, role, status = "active" }) => {
  const user = {
    id: createId(),
    fullName,
    email: email.toLowerCase().trim(),
    passwordHash,
    role,
    status,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (useSupabase && supabase) {
    return supabase
      .from("app_users")
      .insert({
        name: fullName,
        email: user.email,
        password: passwordHash,
        role,
        status,
      })
      .select()
      .single()
      .then(({ data, error }) => {
        if (error) {
          throw error;
        }
        return normalizeAppUser({ ...data, fullName: data.name, passwordHash: data.password });
      })
      .catch((error) => {
        logSupabaseFallback("Supabase user insert failed, using memory fallback:", error);
        state.users.push(user);
        return toUserRecord(user);
      });
  }

  state.users.push(user);
  return toUserRecord(user);
};

const createCustomerProfile = ({
  userId,
  createdBy,
  fullName,
  email,
  phone,
  dateOfBirth,
  address,
  identityType,
  identityNumber,
  status = "active",
}) => {
  const customerCode = `CUS-${Date.now().toString(36).toUpperCase()}-${Math.random()
    .toString(36)
    .slice(2, 6)
    .toUpperCase()}`;
  const customer = {
    id: createId(),
    userId: userId || null,
    createdBy: createdBy || null,
    customerCode,
    fullName,
    email: email.toLowerCase().trim(),
    phone: phone || null,
    dateOfBirth: dateOfBirth || null,
    address: address || null,
    identityType: identityType || null,
    identityNumber: identityNumber || null,
    status,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (useSupabase && supabase) {
    return supabase
      .from("customers")
      .insert({
        user_id: userId ? ensureUuid(userId) : null,
        created_by: createdBy ? ensureUuid(createdBy) : null,
        customer_code: customerCode,
        name: fullName,
        dob: dateOfBirth || null,
        phone: phone || null,
        address: address || null,
        email: customer.email,
        identity_type: identityType || null,
        identity_number: identityNumber || null,
        status,
      })
      .select()
      .single()
      .then(({ data, error }) => {
        if (error) {
          throw error;
        }
        return normalizeCustomer({
          ...data,
          fullName: data.name,
          userId: data.user_id,
          createdBy: data.created_by,
          identityType: data.identity_type || identityType,
          identityNumber: data.identity_number || identityNumber,
        });
      })
      .catch((error) => {
        logSupabaseFallback("Supabase customer insert failed, using memory fallback:", error);
        state.customers.push(customer);
        return customer;
      });
  }

  state.customers.push(customer);
  return customer;
};

const findCustomerByUserId = async (userId) => {
  if (useSupabase && supabase) {
    try {
      const { data, error } = await supabase.from("customers").select("*").eq("user_id", userId).maybeSingle();

      if (error) {
        throw error;
      }

      return data ? normalizeCustomer({ ...data, fullName: data.name, userId: data.user_id }) : null;
    } catch (error) {
      console.warn("Supabase customer lookup failed, using memory fallback:", error.message);
    }
  }

  return state.customers.find((customer) => customer.userId === userId) || null;
};

const findCustomerById = async (customerId) => {
  if (useSupabase && supabase) {
    try {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("id", customerId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data
        ? normalizeCustomer({
            ...data,
            fullName: data.name,
            userId: data.user_id,
            createdBy: data.created_by,
          })
        : null;
    } catch (error) {
      console.warn("Supabase customer lookup by id failed, using memory fallback:", error.message);
    }
  }

  return state.customers.find((customer) => customer.id === customerId) || null;
};

const findCustomerByEmail = async (email) => {
  const normalizedEmail = email.toLowerCase().trim();

  if (useSupabase && supabase) {
    try {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .ilike("email", normalizedEmail)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data
        ? normalizeCustomer({
            ...data,
            fullName: data.name,
            userId: data.user_id,
            createdBy: data.created_by,
          })
        : null;
    } catch (error) {
      console.warn("Supabase customer lookup by email failed, using memory fallback:", error.message);
    }
  }

  return state.customers.find((customer) => customer.email === normalizedEmail) || null;
};

const listCustomers = async ({ search = "", status, page = 1, limit = 10 } = {}) => {
  const normalizedSearch = search.trim().toLowerCase();
  const normalizedPage = Math.max(Number(page) || 1, 1);
  const normalizedLimit = Math.min(Math.max(Number(limit) || 10, 1), 50);

  if (useSupabase && supabase) {
    try {
      let query = supabase
        .from("customers")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false });

      if (status) {
        query = query.eq("status", status);
      }

      if (normalizedSearch) {
        const escapedSearch = normalizedSearch.replace(/[%_]/g, "\\$&");
        query = query.or(
          `name.ilike.%${escapedSearch}%,email.ilike.%${escapedSearch}%,phone.ilike.%${escapedSearch}%,customer_code.ilike.%${escapedSearch}%`
        );
      }

      const from = (normalizedPage - 1) * normalizedLimit;
      const to = from + normalizedLimit - 1;
      const { data, error, count } = await query.range(from, to);

      if (error) {
        throw error;
      }

      return {
        customers: (data || []).map((row) =>
          normalizeCustomer({
            ...row,
            fullName: row.name,
            userId: row.user_id,
            createdBy: row.created_by,
          })
        ),
        page: normalizedPage,
        limit: normalizedLimit,
        total: count || 0,
      };
    } catch (error) {
      console.warn("Supabase customer list failed, using memory fallback:", error.message);
    }
  }

  const filteredCustomers = state.customers
    .filter((customer) => {
      if (status && customer.status !== status) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return [
        customer.customerCode,
        customer.fullName,
        customer.email,
        customer.phone,
        customer.address,
      ]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalizedSearch));
    })
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());

  const start = (normalizedPage - 1) * normalizedLimit;

  return {
    customers: filteredCustomers.slice(start, start + normalizedLimit),
    page: normalizedPage,
    limit: normalizedLimit,
    total: filteredCustomers.length,
  };
};

const updateCustomerProfile = async (customerId, patch) => {
  const cleanedPatch = {
    ...(patch.fullName !== undefined ? { fullName: patch.fullName } : {}),
    ...(patch.email !== undefined ? { email: patch.email.toLowerCase().trim() } : {}),
    ...(patch.phone !== undefined ? { phone: patch.phone || null } : {}),
    ...(patch.dateOfBirth !== undefined ? { dateOfBirth: patch.dateOfBirth || null } : {}),
    ...(patch.address !== undefined ? { address: patch.address || null } : {}),
    ...(patch.identityType !== undefined ? { identityType: patch.identityType || null } : {}),
    ...(patch.identityNumber !== undefined ? { identityNumber: patch.identityNumber || null } : {}),
    ...(patch.status !== undefined ? { status: patch.status } : {}),
    updatedAt: new Date().toISOString(),
  };

  if (useSupabase && supabase) {
    try {
      const updatePayload = {};

      if (cleanedPatch.fullName !== undefined) updatePayload.name = cleanedPatch.fullName;
      if (cleanedPatch.email !== undefined) updatePayload.email = cleanedPatch.email;
      if (cleanedPatch.phone !== undefined) updatePayload.phone = cleanedPatch.phone;
      if (cleanedPatch.dateOfBirth !== undefined) updatePayload.dob = cleanedPatch.dateOfBirth;
      if (cleanedPatch.address !== undefined) updatePayload.address = cleanedPatch.address;
      if (cleanedPatch.identityType !== undefined) updatePayload.identity_type = cleanedPatch.identityType;
      if (cleanedPatch.identityNumber !== undefined) updatePayload.identity_number = cleanedPatch.identityNumber;
      if (cleanedPatch.status !== undefined) updatePayload.status = cleanedPatch.status;
      updatePayload.updated_at = cleanedPatch.updatedAt;

      const { data, error } = await supabase
        .from("customers")
        .update(updatePayload)
        .eq("id", customerId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return normalizeCustomer({
        ...data,
        fullName: data.name,
        userId: data.user_id,
        createdBy: data.created_by,
        identityType: data.identity_type || cleanedPatch.identityType,
        identityNumber: data.identity_number || cleanedPatch.identityNumber,
      });
    } catch (error) {
      console.warn("Supabase customer update failed, using memory fallback:", error.message);
    }
  }

  const customer = state.customers.find((entry) => entry.id === customerId);

  if (!customer) {
    return null;
  }

  Object.assign(customer, cleanedPatch);
  return customer;
};

const createPolicy = ({ customerId, policyType, policyNumber, premiumAmount, startDate, endDate, status }) => {
  const policy = {
    id: createId(),
    customerId,
    policyType,
    policyNumber,
    premiumAmount,
    startDate,
    endDate,
    status,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (useSupabase && supabase) {
    return supabase
      .from("policies")
      .insert({
        customer_id: ensureUuid(customerId),
        policy_type: policyType,
        policy_number: policyNumber,
        premium_amount: premiumAmount,
        start_date: startDate,
        end_date: endDate,
        status,
      })
      .select()
      .single()
      .then(({ data, error }) => {
        if (error) {
          throw error;
        }
        return normalizePolicy({ ...data, customerId: data.customer_id });
      })
      .catch((error) => {
        console.warn("Supabase policy insert failed, using memory fallback:", error.message);
        state.policies.push(policy);
        return policy;
      });
  }

  state.policies.push(policy);
  return policy;
};

const findPoliciesByCustomerId = async (customerId) => {
  if (useSupabase && supabase) {
    try {
      const { data, error } = await supabase.from("policies").select("*").eq("customer_id", customerId);

      if (error) {
        throw error;
      }

      return (data || []).map((row) => normalizePolicy({ ...row, customerId: row.customer_id }));
    } catch (error) {
      console.warn("Supabase policy lookup failed, using memory fallback:", error.message);
    }
  }

  return state.policies.filter((policy) => policy.customerId === customerId);
};

const findActivePolicyByCustomerId = async (customerId) => {
  if (useSupabase && supabase) {
    try {
      const { data, error } = await supabase.from("policies").select("*").eq("customer_id", customerId).eq("status", "active").maybeSingle();

      if (error) {
        throw error;
      }

      return data ? normalizePolicy({ ...data, customerId: data.customer_id }) : null;
    } catch (error) {
      console.warn("Supabase active policy lookup failed, using memory fallback:", error.message);
    }
  }

  return state.policies.find((policy) => policy.customerId === customerId && policy.status === "active") || null;
};

const createDocument = ({ customerId, fileName, filePath, uploadedAt }) => {
  const document = {
    id: createId(),
    customerId,
    fileName,
    filePath,
    uploadedAt,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (useSupabase && supabase) {
    return supabase
      .from("documents")
      .insert({
        customer_id: ensureUuid(customerId),
        file_name: fileName,
        file_path: filePath,
        uploaded_at: uploadedAt,
      })
      .select()
      .single()
      .then(({ data, error }) => {
        if (error) {
          throw error;
        }
        return normalizeDocument({ ...data, customerId: data.customer_id });
      })
      .catch((error) => {
        console.warn("Supabase document insert failed, using memory fallback:", error.message);
        state.documents.unshift(document);
        return document;
      });
  }

  state.documents.unshift(document);
  return document;
};

const findDocumentsByCustomerId = async (customerId) => {
  if (useSupabase && supabase) {
    try {
      const { data, error } = await supabase.from("documents").select("*").eq("customer_id", customerId);

      if (error) {
        throw error;
      }

      return (data || []).map((row) => normalizeDocument({ ...row, customerId: row.customer_id }));
    } catch (error) {
      console.warn("Supabase document lookup failed, using memory fallback:", error.message);
    }
  }

  return state.documents.filter((document) => document.customerId === customerId);
};

const createPremiumPayment = ({ customerId, policyId, amount, paymentMethod, paymentStatus = "paid" }) => {
  const payment = {
    id: createId(),
    customerId,
    policyId: policyId || null,
    amount,
    paymentMethod,
    paymentStatus,
    paymentDate: new Date().toISOString().slice(0, 10),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (useSupabase && supabase) {
    return supabase
      .from("premium_payments")
      .insert({
        policy_id: ensureUuid(policyId),
        amount,
        payment_status: paymentStatus,
        payment_date: payment.createdAt.slice(0, 10),
      })
      .select()
      .single()
      .then(({ data, error }) => {
        if (error) {
          throw error;
        }
        return normalizePremiumPayment({ ...data, policyId: data.policy_id, paymentStatus: data.payment_status, paymentDate: data.payment_date, paymentMethod: data.payment_method });
      })
      .catch((error) => {
        console.warn("Supabase premium payment insert failed, using memory fallback:", error.message);
        state.premiumPayments.push(payment);
        return payment;
      });
  }

  state.premiumPayments.push(payment);
  return payment;
};

const findPremiumPaymentsByCustomerId = async (customerId) => {
  if (useSupabase && supabase) {
    try {
      const policies = await findPoliciesByCustomerId(customerId);
      if (!policies.length) {
        return [];
      }

      const policyIds = policies.map((policy) => policy.id);
      const { data, error } = await supabase.from("premium_payments").select("*").in("policy_id", policyIds);

      if (error) {
        throw error;
      }

      return (data || []).map((row) => normalizePremiumPayment({ ...row, policyId: row.policy_id, paymentStatus: row.payment_status, paymentDate: row.payment_date, paymentMethod: row.payment_method }));
    } catch (error) {
      console.warn("Supabase premium payment lookup failed, using memory fallback:", error.message);
    }
  }

  return state.premiumPayments.filter((payment) => payment.customerId === customerId);
};

const createClaim = ({ policyId, claimAmount, reason, status = "submitted" }) => {
  const claim = {
    id: createId(),
    policyId,
    claimAmount,
    reason,
    status,
    submissionDate: new Date().toISOString().slice(0, 10),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (useSupabase && supabase) {
    return supabase
      .from("claims")
      .insert({
        policy_id: ensureUuid(policyId),
        claim_amount: claimAmount,
        reason,
        status,
        submission_date: claim.submissionDate,
      })
      .select()
      .single()
      .then(({ data, error }) => {
        if (error) {
          throw error;
        }
        return normalizeClaim({ ...data, policyId: data.policy_id, claimAmount: data.claim_amount, submissionDate: data.submission_date });
      })
      .catch((error) => {
        console.warn("Supabase claim insert failed, using memory fallback:", error.message);
        state.claims.push(claim);
        return claim;
      });
  }

  state.claims.push(claim);
  return claim;
};

const findClaimsByCustomerId = async (customerId) => {
  if (useSupabase && supabase) {
    try {
      const policies = await findPoliciesByCustomerId(customerId);
      if (!policies.length) {
        return [];
      }

      const policyIds = policies.map((policy) => policy.id);
      const { data, error } = await supabase.from("claims").select("*").in("policy_id", policyIds);

      if (error) {
        throw error;
      }

      return (data || []).map((row) => normalizeClaim({ ...row, policyId: row.policy_id, claimAmount: row.claim_amount, submissionDate: row.submission_date }));
    } catch (error) {
      console.warn("Supabase claim lookup failed, using memory fallback:", error.message);
    }
  }

  const customerPolicies = state.policies
    .filter((policy) => policy.customerId === customerId)
    .map((policy) => policy.id);

  return state.claims.filter((claim) => customerPolicies.includes(claim.policyId));
};

const findUserByEmail = async (email) => {
  const normalizedEmail = email.toLowerCase().trim();

  if (useSupabase && supabase) {
    try {
      const { data, error } = await supabase.from("app_users").select("*").ilike("email", normalizedEmail).maybeSingle();

      if (error) {
        throw error;
      }

      return data ? normalizeAppUser({ ...data, fullName: data.name, passwordHash: data.password }) : null;
    } catch (error) {
      console.warn("Supabase user lookup failed, using memory fallback:", error.message);
    }
  }

  return state.users.find((user) => user.email === normalizedEmail) || null;
};

const findUserById = async (id) => {
  if (useSupabase && supabase) {
    try {
      const { data, error } = await supabase.from("app_users").select("*").eq("id", id).maybeSingle();

      if (error) {
        throw error;
      }

      return data ? normalizeAppUser({ ...data, fullName: data.name, passwordHash: data.password }) : null;
    } catch (error) {
      console.warn("Supabase user lookup by id failed, using memory fallback:", error.message);
    }
  }

  return state.users.find((user) => user.id === id) || null;
};

const updateUserPassword = async (userId, passwordHash) => {
  if (useSupabase && supabase) {
    try {
      const { data, error } = await supabase.from("app_users").update({ password: passwordHash, updated_at: new Date().toISOString() }).eq("id", userId).select().single();

      if (error) {
        throw error;
      }

      return normalizeAppUser({ ...data, fullName: data.name, passwordHash: data.password });
    } catch (error) {
      console.warn("Supabase password update failed, using memory fallback:", error.message);
    }
  }

  const user = state.users.find((entry) => entry.id === userId);

  if (!user) {
    return null;
  }

  user.passwordHash = passwordHash;
  user.updatedAt = new Date().toISOString();
  return user;
};

const createSession = ({ userId, jwtId, tokenHash, expiresAt, req }) => {
  const session = {
    id: createId(),
    userId,
    jwtId,
    tokenHash,
    expiresAt: new Date(expiresAt).toISOString(),
    revokedAt: null,
    lastSeenAt: null,
    ipAddress: req?.ip || null,
    userAgent: req?.get?.("user-agent") || null,
    createdAt: new Date().toISOString(),
  };

  if (useSupabase && supabase) {
    return supabase
      .from("auth_sessions")
      .insert({
        user_id: ensureUuid(userId),
        jwt_id: jwtId,
        token_hash: tokenHash,
        expires_at: session.expiresAt,
        revoked_at: null,
        last_seen_at: null,
        ip_address: session.ipAddress,
        user_agent: session.userAgent,
      })
      .select()
      .single()
      .then(({ data, error }) => {
        if (error) {
          throw error;
        }
        return normalizeSession({ ...data, userId: data.user_id, jwtId: data.jwt_id, tokenHash: data.token_hash, expiresAt: data.expires_at, revokedAt: data.revoked_at, lastSeenAt: data.last_seen_at, ipAddress: data.ip_address, userAgent: data.user_agent });
      })
      .catch((error) => {
        console.warn("Supabase session insert failed, using memory fallback:", error.message);
        state.sessions.push(session);
        return session;
      });
  }

  state.sessions.push(session);
  return session;
};

const findSessionByTokenHash = async (tokenHash) => {
  const now = Date.now();

  if (useSupabase && supabase) {
    try {
      const { data, error } = await supabase.from("auth_sessions").select("*").eq("token_hash", tokenHash).is("revoked_at", null);

      if (error) {
        throw error;
      }

      const activeSession = (data || []).find((entry) => new Date(entry.expires_at).getTime() > now);
      return activeSession ? normalizeSession({ ...activeSession, userId: activeSession.user_id, jwtId: activeSession.jwt_id, tokenHash: activeSession.token_hash, expiresAt: activeSession.expires_at, revokedAt: activeSession.revoked_at, lastSeenAt: activeSession.last_seen_at, ipAddress: activeSession.ip_address, userAgent: activeSession.user_agent }) : null;
    } catch (error) {
      console.warn("Supabase session lookup failed, using memory fallback:", error.message);
    }
  }

  return (
    state.sessions.find((session) => {
      if (session.tokenHash !== tokenHash || session.revokedAt) {
        return false;
      }

      return new Date(session.expiresAt).getTime() > now;
    }) || null
  );
};

const revokeSessionById = async (sessionId) => {
  if (useSupabase && supabase) {
    try {
      const { error } = await supabase.from("auth_sessions").update({ revoked_at: new Date().toISOString() }).eq("id", sessionId);

      if (error) {
        throw error;
      }

      return true;
    } catch (error) {
      console.warn("Supabase session revoke failed, using memory fallback:", error.message);
    }
  }

  const session = state.sessions.find((entry) => entry.id === sessionId);

  if (!session) {
    return false;
  }

  session.revokedAt = new Date().toISOString();
  return true;
};

const revokeUserSessions = async (userId) => {
  if (useSupabase && supabase) {
    try {
      await supabase.from("auth_sessions").update({ revoked_at: new Date().toISOString() }).eq("user_id", userId);
      return;
    } catch (error) {
      console.warn("Supabase session revocation failed, using memory fallback:", error.message);
    }
  }

  state.sessions.forEach((session) => {
    if (session.userId === userId && !session.revokedAt) {
      session.revokedAt = new Date().toISOString();
    }
  });
};

const upsertSessionLastSeen = async (sessionId) => {
  if (useSupabase && supabase) {
    try {
      const { data, error } = await supabase.from("auth_sessions").update({ last_seen_at: new Date().toISOString() }).eq("id", sessionId).select().single();

      if (error) {
        throw error;
      }

      return normalizeSession({ ...data, userId: data.user_id, jwtId: data.jwt_id, tokenHash: data.token_hash, expiresAt: data.expires_at, revokedAt: data.revoked_at, lastSeenAt: data.last_seen_at, ipAddress: data.ip_address, userAgent: data.user_agent });
    } catch (error) {
      console.warn("Supabase session last seen update failed, using memory fallback:", error.message);
    }
  }

  const session = state.sessions.find((entry) => entry.id === sessionId);

  if (!session) {
    return null;
  }

  session.lastSeenAt = new Date().toISOString();
  return session;
};

const createPasswordResetToken = ({ userId, tokenHash, expiresAt }) => {
  const token = {
    id: createId(),
    userId,
    tokenHash,
    expiresAt: new Date(expiresAt).toISOString(),
    usedAt: null,
    createdAt: new Date().toISOString(),
  };

  if (useSupabase && supabase) {
    return supabase
      .from("password_reset_tokens")
      .insert({
        user_id: ensureUuid(userId),
        token_hash: tokenHash,
        expires_at: token.expiresAt,
      })
      .select()
      .single()
      .then(({ data, error }) => {
        if (error) {
          throw error;
        }
        return normalizeResetToken({ ...data, userId: data.user_id, tokenHash: data.token_hash, expiresAt: data.expires_at, usedAt: data.used_at });
      })
      .catch((error) => {
        console.warn("Supabase reset token insert failed, using memory fallback:", error.message);
        state.passwordResetTokens.push(token);
        return token;
      });
  }

  state.passwordResetTokens.push(token);
  return token;
};

const revokePasswordResetTokensForUser = async (userId) => {
  if (useSupabase && supabase) {
    try {
      await supabase.from("password_reset_tokens").update({ used_at: new Date().toISOString() }).eq("user_id", userId).is("used_at", null);
      return;
    } catch (error) {
      console.warn("Supabase reset token revoke failed, using memory fallback:", error.message);
    }
  }

  state.passwordResetTokens.forEach((token) => {
    if (token.userId === userId && !token.usedAt) {
      token.usedAt = new Date().toISOString();
    }
  });
};

const findPasswordResetTokenByHash = async (tokenHash) => {
  const now = Date.now();

  if (useSupabase && supabase) {
    try {
      const { data, error } = await supabase.from("password_reset_tokens").select("*").eq("token_hash", tokenHash).is("used_at", null);

      if (error) {
        throw error;
      }

      const token = (data || []).find((entry) => new Date(entry.expires_at).getTime() > now);
      return token ? normalizeResetToken({ ...token, userId: token.user_id, tokenHash: token.token_hash, expiresAt: token.expires_at, usedAt: token.used_at }) : null;
    } catch (error) {
      console.warn("Supabase reset token lookup failed, using memory fallback:", error.message);
    }
  }

  return (
    state.passwordResetTokens.find((token) => {
      if (token.tokenHash !== tokenHash || token.usedAt) {
        return false;
      }

      return new Date(token.expiresAt).getTime() > now;
    }) || null
  );
};

const markPasswordResetTokenUsed = async (tokenId) => {
  if (useSupabase && supabase) {
    try {
      const { error } = await supabase.from("password_reset_tokens").update({ used_at: new Date().toISOString() }).eq("id", tokenId);

      if (error) {
        throw error;
      }

      return true;
    } catch (error) {
      console.warn("Supabase reset token mark used failed, using memory fallback:", error.message);
    }
  }

  const token = state.passwordResetTokens.find((entry) => entry.id === tokenId);

  if (!token) {
    return false;
  }

  token.usedAt = new Date().toISOString();
  return true;
};

const recordAuditLog = ({ actorUserId, action, entityType, entityId, metadata = {} }) => {
  const log = {
    id: createId(),
    actorUserId,
    action,
    entityType,
    entityId,
    metadata,
    createdAt: new Date().toISOString(),
  };

  if (useSupabase && supabase) {
    return supabase
      .from("audit_logs")
      .insert({
        actor_user_id: actorUserId ? ensureUuid(actorUserId) : null,
        action,
        entity_type: entityType,
        entity_id: entityId,
        metadata,
      })
      .select()
      .single()
      .then(({ data, error }) => {
        if (error) {
          throw error;
        }
        return normalizeAuditLog({ ...data, actorUserId: data.actor_user_id, entityType: data.entity_type, entityId: data.entity_id });
      })
      .catch((error) => {
        console.warn("Supabase audit log insert failed, using memory fallback:", error.message);
        state.auditLogs.push(log);
        return log;
      });
  }

  state.auditLogs.push(log);
  return log;
};

module.exports = {
  createClaim,
  createCustomerProfile,
  createDocument,
  createPasswordResetToken,
  createPolicy,
  createPremiumPayment,
  createSession,
  createUser,
  findActivePolicyByCustomerId,
  findClaimsByCustomerId,
  findCustomerByEmail,
  findCustomerById,
  findCustomerByUserId,
  findDocumentsByCustomerId,
  findPasswordResetTokenByHash,
  findPoliciesByCustomerId,
  findPremiumPaymentsByCustomerId,
  findSessionByTokenHash,
  findUserByEmail,
  findUserById,
  listCustomers,
  markPasswordResetTokenUsed,
  recordAuditLog,
  revokePasswordResetTokensForUser,
  revokeSessionById,
  revokeUserSessions,
  updateCustomerProfile,
  updateUserPassword,
  upsertSessionLastSeen,
};
