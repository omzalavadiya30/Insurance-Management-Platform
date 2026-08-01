const createId = () => `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const state = {
  users: [],
  customers: [],
  sessions: [],
  passwordResetTokens: [],
  auditLogs: [],
};

const toUserRecord = (user) => ({
  ...user,
  createdAt: user.createdAt || new Date().toISOString(),
  updatedAt: user.updatedAt || new Date().toISOString(),
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

  state.users.push(user);
  return toUserRecord(user);
};

const createCustomerProfile = ({ userId, fullName, email, phone, dateOfBirth, address }) => {
  const customer = {
    id: createId(),
    userId,
    fullName,
    email: email.toLowerCase().trim(),
    phone: phone || null,
    dateOfBirth: dateOfBirth || null,
    address: address || null,
    status: "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  state.customers.push(customer);
  return customer;
};

const findUserByEmail = (email) => {
  const normalizedEmail = email.toLowerCase().trim();
  return state.users.find((user) => user.email === normalizedEmail) || null;
};

const findUserById = (id) => state.users.find((user) => user.id === id) || null;

const updateUserPassword = (userId, passwordHash) => {
  const user = findUserById(userId);

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

  state.sessions.push(session);
  return session;
};

const findSessionByTokenHash = (tokenHash) => {
  const now = Date.now();
  return (
    state.sessions.find((session) => {
      if (session.tokenHash !== tokenHash || session.revokedAt) {
        return false;
      }

      return new Date(session.expiresAt).getTime() > now;
    }) || null
  );
};

const revokeSessionById = (sessionId) => {
  const session = state.sessions.find((entry) => entry.id === sessionId);

  if (!session) {
    return false;
  }

  session.revokedAt = new Date().toISOString();
  return true;
};

const revokeUserSessions = (userId) => {
  state.sessions.forEach((session) => {
    if (session.userId === userId && !session.revokedAt) {
      session.revokedAt = new Date().toISOString();
    }
  });
};

const upsertSessionLastSeen = (sessionId) => {
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

  state.passwordResetTokens.push(token);
  return token;
};

const revokePasswordResetTokensForUser = (userId) => {
  state.passwordResetTokens.forEach((token) => {
    if (token.userId === userId && !token.usedAt) {
      token.usedAt = new Date().toISOString();
    }
  });
};

const findPasswordResetTokenByHash = (tokenHash) => {
  const now = Date.now();
  return (
    state.passwordResetTokens.find((token) => {
      if (token.tokenHash !== tokenHash || token.usedAt) {
        return false;
      }

      return new Date(token.expiresAt).getTime() > now;
    }) || null
  );
};

const markPasswordResetTokenUsed = (tokenId) => {
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

  state.auditLogs.push(log);
  return log;
};

module.exports = {
  createCustomerProfile,
  createPasswordResetToken,
  createSession,
  createUser,
  findPasswordResetTokenByHash,
  findSessionByTokenHash,
  findUserByEmail,
  findUserById,
  markPasswordResetTokenUsed,
  recordAuditLog,
  revokePasswordResetTokensForUser,
  revokeSessionById,
  revokeUserSessions,
  updateUserPassword,
  upsertSessionLastSeen,
};
