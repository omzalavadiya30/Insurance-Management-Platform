const cors = require("cors");
const express = require("express");
const env = require("./config/env");
const authRoutes = require("./routes/auth.routes");
const customerRoutes = require("./routes/customer.routes");
const { errorHandler, notFound } = require("./middleware/error-handler");

const app = express();

app.use(
  cors({
    origin: env.corsOrigin.split(",").map((origin) => origin.trim()),
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Insurance Management API is running.",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/customers", customerRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
