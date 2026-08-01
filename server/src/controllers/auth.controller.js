const authService = require("../services/auth.service");

const register = async (req, res, next) => {
  try {
    const data = await authService.register({
      ...req.validatedBody,
      req,
    });

    return res.status(201).json({
      success: true,
      message: "Account created successfully.",
      data,
    });
  } catch (error) {
    return next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const data = await authService.login({
      ...req.validatedBody,
      req,
    });

    return res.json({
      success: true,
      message: "Logged in successfully.",
      data,
    });
  } catch (error) {
    return next(error);
  }
};

const me = (req, res) =>
  res.json({
    success: true,
    data: {
      user: authService.sanitizeUser(req.auth.user),
      session: {
        id: req.auth.sessionId,
        expiresAt: req.auth.sessionExpiresAt,
      },
    },
  });

const logout = async (req, res, next) => {
  try {
    await authService.logout({ sessionId: req.auth.sessionId });

    return res.json({
      success: true,
      message: "Logged out successfully.",
    });
  } catch (error) {
    return next(error);
  }
};

const forgotPassword = async (req, res, next) => {
  try {
    await authService.requestPasswordReset(req.validatedBody);

    return res.json({
      success: true,
      message:
        "If this email exists, a password reset link will be sent shortly.",
    });
  } catch (error) {
    return next(error);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    await authService.resetPassword(req.validatedBody);

    return res.json({
      success: true,
      message: "Your password has been reset. Please log in again.",
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  forgotPassword,
  login,
  logout,
  me,
  register,
  resetPassword,
};
