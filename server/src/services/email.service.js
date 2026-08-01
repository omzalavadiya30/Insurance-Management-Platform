const env = require("../config/env");
const { Resend } = require("resend");

let resendClient;

const getResendClient = () => {
  if (!env.resendApiKey) {
    throw new Error("RESEND_API_KEY is required to send password reset email.");
  }

  if (!resendClient) {
    resendClient = new Resend(env.resendApiKey);
  }

  return resendClient;
};

const buildResetPasswordUrl = (token) => {
  const resetUrl = new URL("/reset-password", env.clientAppUrl);
  resetUrl.searchParams.set("token", token);
  return resetUrl.toString();
};

const sendPasswordResetEmail = async ({ email, fullName, resetUrl, token }) => {
  const messageResetUrl = resetUrl || buildResetPasswordUrl(token);
  const firstName = fullName?.split(" ")[0] || "there";

  if (!env.resendApiKey) {
    throw new Error("RESEND_API_KEY is required to send password reset email.");
  }

  if (!env.resendFromEmail) {
    throw new Error(
      "RESEND_FROM_EMAIL must be set to a verified sender address from your Resend account."
    );
  }

  try {
    const { data, error } = await getResendClient().emails.send({
      from: env.resendFromEmail,
      to: [email],
      subject: "Reset your Insurance Management password",
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #18181b;">
          <h2>Reset your password</h2>
          <p>Hi ${firstName},</p>
          <p>We received a request to reset your Insurance Management password.</p>
          <p>
            <a href="${messageResetUrl}" style="display: inline-block; padding: 12px 18px; background: #0f766e; color: #ffffff; border-radius: 8px; text-decoration: none;">
              Reset password
            </a>
          </p>
          <p>This link expires in ${env.resetTokenTtlMinutes} minutes. If you did not request this, you can ignore this email.</p>
          <p>If the button does not work, copy and paste this URL into your browser:</p>
          <p style="word-break: break-all;">${messageResetUrl}</p>
        </div>
      `,
      text: [
        "Reset your Insurance Management password",
        "",
        `Hi ${firstName},`,
        "",
        "We received a request to reset your password.",
        `Use this link to choose a new password: ${messageResetUrl}`,
        "",
        `This link expires in ${env.resetTokenTtlMinutes} minutes. If you did not request this, you can ignore this email.`,
      ].join("\n"),
    });

    if (error) {
      const reason = error.message || "Failed to send password reset email";
      const detailedReason = reason.includes("sandbox") || reason.includes("verified")
        ? `${reason}. Verify the recipient email and sender domain in your Resend account.`
        : reason;
      throw new Error(detailedReason);
    }

    return { data };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unable to send reset email.";
    console.error("Password reset email delivery failed:", reason);
    throw new Error(reason);
  }
};

module.exports = {
  sendPasswordResetEmail,
};
