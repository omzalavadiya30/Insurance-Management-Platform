const HttpError = require("../utils/http-error");

const notFound = (req, res, next) => {
  next(new HttpError(404, `Route not found: ${req.method} ${req.originalUrl}`));
};

const errorHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  const statusCode = err.statusCode || 500;
  const payload = {
    success: false,
    message:
      statusCode === 500 ? "Something went wrong on the server." : err.message,
  };

  if (err.details) {
    payload.details = err.details;
  }

  if (statusCode === 500) {
    console.error(err);
  }

  return res.status(statusCode).json(payload);
};

module.exports = {
  errorHandler,
  notFound,
};
