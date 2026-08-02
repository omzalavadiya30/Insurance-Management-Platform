const env = require("../config/env");
const jwt = require("jsonwebtoken");
const HttpError = require("../utils/http-error");
const {
  createOpaqueToken,
  hashPassword,
  hashToken,
  verifyPassword,
} = require("../utils/auth-crypto");
const { sendPasswordResetEmail } = require("./email.service");
const storage = require("../config/storage");

const allowedRoles = new Set(["admin", "agent", "customer"]);

const normalizeEmail = (email) => email.trim().toLowerCase();

const sanitizeUser = (user) => ({
  id: user.id,
  fullName: user.fullName,
  email: user.email,
  role: user.role,
  status: user.status,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const createCustomerCode = () =>
  `CUS-${Date.now().toString(36).toUpperCase()}-${Math.random()
    .toString(36)
    .slice(2, 6)
    .toUpperCase()}`;

const recordAuditLog = async ({
  actorUserId,
  action,
  entityType,
  entityId,
  metadata = {},
}) => {
  await storage.recordAuditLog({ actorUserId, action, entityType, entityId, metadata });
};

const createSession = async ({ user, req }) => {
  const jwtId = createOpaqueToken(16);
  const expiresAt = new Date(
    Date.now() + env.sessionTtlDays * 24 * 60 * 60 * 1000
  );
  const token = jwt.sign(
    {
      sub: user.id,
      role: user.role,
    },
    env.jwtSecret,
    {
      jwtid: jwtId,
      expiresIn: `${env.sessionTtlDays}d`,
      issuer: env.jwtIssuer,
      audience: env.jwtAudience,
    }
  );
  const tokenHash = hashToken(token);

  const session = await storage.createSession({
    userId: user.id,
    jwtId,
    tokenHash,
    expiresAt,
    req,
  });

  return {
    token,
    sessionId: session.id,
    expiresAt: session.expiresAt,
  };
};

const register = async ({
  fullName,
  email,
  password,
  role,
  phone,
  dateOfBirth,
  address,
  req,
}) => {
  const normalizedEmail = normalizeEmail(email);
  const requestedRole = allowedRoles.has(role) ? role : "customer";

  const existingUser = await storage.findUserByEmail(normalizedEmail);

  if (existingUser) {
    throw new HttpError(409, "An account with this email already exists.");
  }

  const { passwordHash } = await hashPassword(password);

  const user = await storage.createUser({
    fullName: fullName.trim(),
    email: normalizedEmail,
    passwordHash,
    role: requestedRole,
    status: "active",
  });

  if (requestedRole === "customer") {
    await storage.createCustomerProfile({
      userId: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: phone || null,
      dateOfBirth: dateOfBirth || null,
      address: address || null,
    });
  }

  await recordAuditLog({
    actorUserId: user.id,
    action: "auth.register",
    entityType: "user",
    entityId: user.id,
    metadata: { role: requestedRole },
  });

  const session = await createSession({ user, req });

  return {
    user: sanitizeUser(user),
    token: session.token,
    expiresAt: session.expiresAt,
  };
};

const login = async ({ email, password, role, req }) => {
  const normalizedEmail = normalizeEmail(email);
  const requestedRole = allowedRoles.has(role) ? role : null;

  const user = await storage.findUserByEmail(normalizedEmail);

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    throw new HttpError(401, "Invalid email or password.");
  }

  if (requestedRole && user.role !== requestedRole) {
    throw new HttpError(
      403,
      `This account belongs to the ${user.role} portal. Please choose the correct login role.`
    );
  }

  if (user.status !== "active") {
    throw new HttpError(403, "This account is not active.");
  }

  const session = await createSession({ user, req });

  await recordAuditLog({
    actorUserId: user.id,
    action: "auth.login",
    entityType: "user",
    entityId: user.id,
    metadata: { role: user.role },
  });

  return {
    user: sanitizeUser(user),
    token: session.token,
    expiresAt: session.expiresAt,
  };
};

const logout = async ({ sessionId }) => {
  const revoked = await storage.revokeSessionById(sessionId);

  if (!revoked) {
    throw new HttpError(404, "Session not found.");
  }
};

const requestPasswordReset = async ({ email }) => {
  const normalizedEmail = normalizeEmail(email);
  const user = await storage.findUserByEmail(normalizedEmail);

  if (!user || user.status !== "active") {
    return;
  }

  const rawToken = createOpaqueToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(
    Date.now() + env.resetTokenTtlMinutes * 60 * 1000
  );

  await storage.revokePasswordResetTokensForUser(user.id);
  await storage.createPasswordResetToken({ userId: user.id, tokenHash, expiresAt });

  const resetUrl = `${env.clientAppUrl.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(rawToken)}`;

  try {
    await sendPasswordResetEmail({
      email: user.email,
      fullName: user.fullName,
      resetUrl,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Password reset email could not be sent.";
    console.error("Password reset email delivery failed:", message);
    throw new HttpError(502, message);
  }
};

const resetPassword = async ({ token, password }) => {
  const tokenHash = hashToken(token);
  const resetToken = await storage.findPasswordResetTokenByHash(tokenHash);

  if (!resetToken) {
    throw new HttpError(400, "This reset link is invalid or has already been used.");
  }

  const user = await storage.findUserById(resetToken.userId);

  if (!user || user.status !== "active") {
    throw new HttpError(403, "This account is not active.");
  }

  const { passwordHash } = await hashPassword(password);
  await storage.updateUserPassword(user.id, passwordHash);
  await storage.markPasswordResetTokenUsed(resetToken.id);
  await storage.revokeUserSessions(user.id);

  await recordAuditLog({
    actorUserId: user.id,
    action: "auth.password_reset",
    entityType: "user",
    entityId: user.id,
  });
};

module.exports = {
  login,
  logout,
  register,
  requestPasswordReset,
  resetPassword,
  sanitizeUser,
};
