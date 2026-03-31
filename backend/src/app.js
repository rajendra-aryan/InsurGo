const express = require("express");
const cors = require("cors");
const { errorHandler, notFound } = require("./middleware/errorHandler");

const authRoutes = require("./routes/auth");
const policyRoutes = require("./routes/policies");
const claimRoutes = require("./routes/claims");
const eventRoutes = require("./routes/events");
const premiumRoutes = require("./routes/premium");

const app = express();

// ─── Core Middleware ───────────────────────────────────────
app.use(cors({
  origin: [
    "http://localhost:8080",
    "http://localhost:5173",
    "http://localhost:3000",
    process.env.FRONTEND_URL,
  ].filter(Boolean),
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Health Check ─────────────────────────────────────────
app.get("/health", (req, res) =>
  res.json({ status: "OK", service: "InsurGo API", timestamp: new Date() })
);

// ─── API Routes ───────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/policies", policyRoutes);
app.use("/api/claims", claimRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/premium", premiumRoutes);

// ─── Error Handling ───────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

module.exports = app;
