const customerService = require("../services/customer.service");

const listCustomers = async (req, res, next) => {
  try {
    const data = await customerService.listCustomerProfiles({
      actor: req.auth.user,
      ...req.validatedQuery,
    });

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    return next(error);
  }
};

const createCustomer = async (req, res, next) => {
  try {
    const data = await customerService.createManagedCustomer({
      actor: req.auth.user,
      ...req.validatedBody,
    });

    return res.status(201).json({
      success: true,
      message: "Customer registered successfully.",
      data,
    });
  } catch (error) {
    return next(error);
  }
};

const getCustomer = async (req, res, next) => {
  try {
    const data = await customerService.getCustomerProfile({
      actor: req.auth.user,
      customerId: req.params.id,
    });

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    return next(error);
  }
};

const updateCustomer = async (req, res, next) => {
  try {
    const data = await customerService.updateCustomerProfile({
      actor: req.auth.user,
      customerId: req.params.id,
      patch: req.validatedBody,
    });

    return res.json({
      success: true,
      message: "Customer information updated successfully.",
      data,
    });
  } catch (error) {
    return next(error);
  }
};

const getCustomerHistory = async (req, res, next) => {
  try {
    const data = await customerService.getCustomerHistory({
      actor: req.auth.user,
      customerId: req.params.id,
    });

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    return next(error);
  }
};

const getOwnProfile = async (req, res, next) => {
  try {
    const data = await customerService.getOwnCustomerProfile({
      actor: req.auth.user,
    });

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    return next(error);
  }
};

const updateOwnProfile = async (req, res, next) => {
  try {
    const data = await customerService.updateOwnCustomerProfile({
      actor: req.auth.user,
      patch: req.validatedBody,
    });

    return res.json({
      success: true,
      message: "Your customer profile was updated successfully.",
      data,
    });
  } catch (error) {
    return next(error);
  }
};

const registerCustomer = async (req, res, next) => {
  try {
    const data = await customerService.registerCustomerProfile({
      ...req.validatedBody,
      userId: req.auth.user.id,
    });

    return res.status(201).json({
      success: true,
      message: "Customer profile created successfully.",
      data,
    });
  } catch (error) {
    return next(error);
  }
};

const getDashboard = async (req, res, next) => {
  try {
    const data = await customerService.getCustomerDashboard({
      userId: req.auth.user.id,
    });

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    return next(error);
  }
};

const submitClaim = async (req, res, next) => {
  try {
    const data = await customerService.createCustomerClaim({
      ...req.validatedBody,
      userId: req.auth.user.id,
    });

    return res.status(201).json({
      success: true,
      message: "Claim submitted successfully.",
      data,
    });
  } catch (error) {
    return next(error);
  }
};

const recordPayment = async (req, res, next) => {
  try {
    const data = await customerService.recordPremiumPayment({
      ...req.validatedBody,
      userId: req.auth.user.id,
    });

    return res.status(201).json({
      success: true,
      message: "Premium payment recorded successfully.",
      data,
    });
  } catch (error) {
    return next(error);
  }
};

const uploadDocument = async (req, res, next) => {
  try {
    const data = await customerService.uploadCustomerDocument({
      ...req.validatedBody,
      userId: req.auth.user.id,
    });

    return res.status(201).json({
      success: true,
      message: "Document uploaded successfully.",
      data,
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createCustomer,
  getCustomer,
  getCustomerHistory,
  getDashboard,
  getOwnProfile,
  listCustomers,
  recordPayment,
  registerCustomer,
  submitClaim,
  updateCustomer,
  updateOwnProfile,
  uploadDocument,
};
