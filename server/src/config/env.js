require("dotenv").config();

const numberFromEnv = (key, fallback) => {
  const value = process.env[key];

  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: numberFromEnv("PORT", 5000),
  clientAppUrl: process.env.CLIENT_APP_URL || "http://localhost:3000",
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:3000",
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  jwtSecret:
    process.env.JWT_SECRET ||
    "dev-insurance-auth-secret-change-before-production",
  jwtIssuer: process.env.JWT_ISSUER || "insurance-management-api",
  jwtAudience: process.env.JWT_AUDIENCE || "insurance-management-client",
  resendApiKey: process.env.RESEND_API_KEY,
  resendFromEmail:
    process.env.RESEND_FROM_EMAIL ||
    "Insurance Management <onboarding@resend.dev>",
  sessionTtlDays: numberFromEnv("SESSION_TTL_DAYS", 7),
  resetTokenTtlMinutes: numberFromEnv("RESET_TOKEN_TTL_MINUTES", 60),
};

const requiredKeys = [];

if (env.nodeEnv === "production") {
  requiredKeys.push("JWT_SECRET");
}

const missingKeys = requiredKeys.filter((key) => !process.env[key]);

if (missingKeys.length > 0) {
  throw new Error(
    `Missing required environment variable(s): ${missingKeys.join(", ")}`
  );
}

module.exports = env;
