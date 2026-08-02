const env = require("../config/env");
const jwt = require("jsonwebtoken");
const HttpError = require("../utils/http-error");
const { hashToken } = require("../utils/auth-crypto");
const storage = require("../config/storage");

const getBearerToken = (authorizationHeader) => {
  if (!authorizationHeader || !authorizationHeader.startsWith("Bearer ")) {
    return null;
  }

  return authorizationHeader.slice("Bearer ".length).trim();
};

const authorize =
  (...allowedRoles) =>
  (req, res, next) => {
    if (!req.auth?.user) {
      return next(new HttpError(401, "Authentication is required."));
    }

    if (!allowedRoles.includes(req.auth.user.role)) {
      return next(
        new HttpError(403, "You do not have permission to access this resource.")
      );
    }

    return next();
  };

const authenticate = async (req, res, next) => {
  try {
    const token = getBearerToken(req.headers.authorization);

    if (!token) {
      throw new HttpError(401, "Authentication token is required.");
    }

    let decodedToken;

    try {
      decodedToken = jwt.verify(token, env.jwtSecret, {
        issuer: env.jwtIssuer,
        audience: env.jwtAudience,
      });
    } catch {
      throw new HttpError(401, "Your session is invalid or has expired.");
    }

    const tokenHash = hashToken(token);
    const session = await storage.findSessionByTokenHash(tokenHash);

    if (!session || session.revokedAt) {
      throw new HttpError(401, "Your session is no longer active.");
    }

    if (session.jwtId !== decodedToken.jti || session.userId !== decodedToken.sub) {
      throw new HttpError(401, "Your session could not be verified.");
    }

    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      await storage.revokeSessionById(session.id);
      throw new HttpError(401, "Your session has expired.");
    }

    const user = await storage.findUserById(session.userId);

    if (!user || user.status !== "active") {
      throw new HttpError(401, "This account is not active.");
    }

    if (decodedToken.role !== user.role) {
      throw new HttpError(401, "Your account role has changed. Please log in again.");
    }

    req.auth = {
      sessionId: session.id,
      sessionExpiresAt: session.expiresAt,
      tokenHash,
      user,
    };

    if (env.nodeEnv !== "test") {
      await storage.upsertSessionLastSeen(session.id);
    }

    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports = authenticate;
module.exports.authorize = authorize;
