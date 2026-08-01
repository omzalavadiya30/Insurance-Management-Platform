const express = require("express");
const { z } = require("zod");
const authController = require("../controllers/auth.controller");
const authenticate = require("../middleware/auth");
const validate = require("../middleware/validate");

const router = express.Router();

const roleSchema = z.enum(["admin", "agent", "customer"], {
  error: "Choose administrator, insurance agent, or customer.",
});

const emptyStringToUndefined = (value) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const nameSchema = z
  .string()
  .trim()
  .min(2, "Full name must be at least 2 characters.")
  .max(80, "Full name must be 80 characters or less.")
  .regex(
    /^[A-Za-z][A-Za-z .'-]{1,79}$/,
    "Full name may contain letters, spaces, apostrophes, periods, and hyphens."
  );

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(72, "Password must be 72 characters or less.")
  .regex(/[A-Z]/, "Password must include an uppercase letter.")
  .regex(/[a-z]/, "Password must include a lowercase letter.")
  .regex(/[0-9]/, "Password must include a number.")
  .regex(/[^A-Za-z0-9]/, "Password must include a special character.");

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(120, "Email must be 120 characters or less.")
  .email("Enter a valid email address.");

const optionalPhoneSchema = z.preprocess(
  emptyStringToUndefined,
  z
    .string()
    .trim()
    .regex(
      /^[0-9+\-\s()]{7,20}$/,
      "Phone number may include digits, spaces, +, -, and parentheses."
    )
    .optional()
);

const optionalDateOfBirthSchema = z.preprocess(
  emptyStringToUndefined,
  z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid date of birth.")
    .refine((value) => {
      const parsedDate = new Date(`${value}T00:00:00.000Z`);

      return (
        !Number.isNaN(parsedDate.getTime()) &&
        parsedDate.getTime() <= Date.now()
      );
    }, "Date of birth cannot be in the future.")
    .optional()
);

const optionalAddressSchema = z.preprocess(
  emptyStringToUndefined,
  z
    .string()
    .trim()
    .min(5, "Address must be at least 5 characters when provided.")
    .max(220, "Address must be 220 characters or less.")
    .optional()
);

const registerSchema = z
  .object({
    fullName: nameSchema,
    email: emailSchema,
    password: passwordSchema,
    role: roleSchema,
    phone: optionalPhoneSchema,
    dateOfBirth: optionalDateOfBirthSchema,
    address: optionalAddressSchema,
  })
  .superRefine((data, ctx) => {
    if (data.role !== "customer") {
      return;
    }

    if (!data.phone) {
      ctx.addIssue({
        code: "custom",
        path: ["phone"],
        message: "Phone number is required for customer accounts.",
      });
    }

    if (!data.dateOfBirth) {
      ctx.addIssue({
        code: "custom",
        path: ["dateOfBirth"],
        message: "Date of birth is required for customer accounts.",
      });
    }

    if (!data.address) {
      ctx.addIssue({
        code: "custom",
        path: ["address"],
        message: "Address is required for customer accounts.",
      });
    }
  });

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required."),
  role: roleSchema,
});

const forgotPasswordSchema = z.object({
  email: emailSchema,
});

const resetPasswordSchema = z.object({
  token: z.string().min(20, "Reset token is missing."),
  password: passwordSchema,
});

router.post("/register", validate(registerSchema), authController.register);
router.post("/login", validate(loginSchema), authController.login);
router.get("/me", authenticate, authController.me);
router.post("/logout", authenticate, authController.logout);
router.post(
  "/forgot-password",
  validate(forgotPasswordSchema),
  authController.forgotPassword
);
router.post(
  "/reset-password",
  validate(resetPasswordSchema),
  authController.resetPassword
);

module.exports = router;
