const express = require("express");
const { z } = require("zod");
const customerController = require("../controllers/customer.controller");
const authenticate = require("../middleware/auth");
const { authorize } = require("../middleware/auth");
const validate = require("../middleware/validate");
const HttpError = require("../utils/http-error");

const router = express.Router();

const validateQuery = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.query);

  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    }));

    return next(new HttpError(400, "Please check the submitted filters.", details));
  }

  req.validatedQuery = result.data;
  return next();
};

const emptyStringToUndefined = (value) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const nameSchema = z
  .string()
  .trim()
  .min(2, "Customer name must be at least 2 characters.")
  .max(80, "Customer name must be 80 characters or less.")
  .regex(
    /^[A-Za-z][A-Za-z .'-]{1,79}$/,
    "Customer name may contain letters, spaces, apostrophes, periods, and hyphens."
  );

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(120, "Email must be 120 characters or less.")
  .email("Enter a valid email address.");

const phoneSchema = z
  .string()
  .trim()
  .regex(
    /^[0-9+\-\s()]{7,20}$/,
    "Phone number may include digits, spaces, +, -, and parentheses."
  );

const dateOfBirthSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid date of birth.")
  .refine((value) => {
    const parsedDate = new Date(`${value}T00:00:00.000Z`);

    return (
      !Number.isNaN(parsedDate.getTime()) &&
      parsedDate.getTime() <= Date.now()
    );
  }, "Date of birth cannot be in the future.");

const addressSchema = z
  .string()
  .trim()
  .min(5, "Address must be at least 5 characters.")
  .max(220, "Address must be 220 characters or less.");

const identityTypeSchema = z
  .string()
  .trim()
  .min(2, "Identity type is required.")
  .max(40, "Identity type must be 40 characters or less.");

const identityNumberSchema = z
  .string()
  .trim()
  .min(3, "Identity number is required.")
  .max(40, "Identity number must be 40 characters or less.");

const statusSchema = z.enum(["active", "disabled"], {
  error: "Status must be active or disabled.",
});

const optionalTrimmed = (schema) =>
  z.preprocess(emptyStringToUndefined, schema.optional());

const customerCreateSchema = z.object({
  fullName: nameSchema,
  email: emailSchema,
  phone: phoneSchema,
  dateOfBirth: dateOfBirthSchema,
  address: addressSchema,
  identityType: identityTypeSchema,
  identityNumber: identityNumberSchema,
  status: statusSchema.default("active"),
});

const customerUpdateSchema = z
  .object({
    fullName: optionalTrimmed(nameSchema),
    email: optionalTrimmed(emailSchema),
    phone: optionalTrimmed(phoneSchema),
    dateOfBirth: optionalTrimmed(dateOfBirthSchema),
    address: optionalTrimmed(addressSchema),
    identityType: optionalTrimmed(identityTypeSchema),
    identityNumber: optionalTrimmed(identityNumberSchema),
    status: statusSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one customer field is required.",
  });

const customerSelfUpdateSchema = z
  .object({
    fullName: optionalTrimmed(nameSchema),
    phone: optionalTrimmed(phoneSchema),
    dateOfBirth: optionalTrimmed(dateOfBirthSchema),
    address: optionalTrimmed(addressSchema),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one profile field is required.",
  });

const customerListSchema = z.object({
  search: z.string().trim().max(80).optional().default(""),
  status: statusSchema.optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
});

const registrationSchema = customerCreateSchema.omit({ status: true });

const claimSchema = z.object({
  claimAmount: z.coerce.number().positive("Claim amount must be greater than 0."),
  reason: z.string().trim().min(5, "Reason must be at least 5 characters."),
});

const paymentSchema = z.object({
  amount: z.coerce.number().positive("Amount must be greater than 0."),
  paymentMethod: z.string().trim().min(2, "Payment method is required."),
});

const documentSchema = z.object({
  fileName: z.string().trim().min(1, "File name is required.").max(120),
  filePath: z.string().trim().min(1, "File path is required.").max(260),
});

router.use(authenticate);

router.get(
  "/",
  authorize("admin", "agent"),
  validateQuery(customerListSchema),
  customerController.listCustomers
);
router.post(
  "/",
  authorize("admin", "agent"),
  validate(customerCreateSchema),
  customerController.createCustomer
);
router.get("/me", authorize("customer"), customerController.getOwnProfile);
router.patch(
  "/me",
  authorize("customer"),
  validate(customerSelfUpdateSchema),
  customerController.updateOwnProfile
);

router.post(
  "/register",
  authorize("customer"),
  validate(registrationSchema),
  customerController.registerCustomer
);
router.get("/dashboard", authorize("customer"), customerController.getDashboard);
router.post(
  "/claims",
  authorize("customer"),
  validate(claimSchema),
  customerController.submitClaim
);
router.post(
  "/payments",
  authorize("customer"),
  validate(paymentSchema),
  customerController.recordPayment
);
router.post(
  "/documents",
  authorize("customer"),
  validate(documentSchema),
  customerController.uploadDocument
);

router.get("/:id/history", customerController.getCustomerHistory);
router.get("/:id", customerController.getCustomer);
router.patch(
  "/:id",
  authorize("admin", "agent"),
  validate(customerUpdateSchema),
  customerController.updateCustomer
);

module.exports = router;
