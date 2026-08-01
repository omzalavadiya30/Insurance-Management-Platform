const HttpError = require("../utils/http-error");

const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);

  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    }));

    return next(new HttpError(400, "Please check the submitted fields.", details));
  }

  req.validatedBody = result.data;
  return next();
};

module.exports = validate;
