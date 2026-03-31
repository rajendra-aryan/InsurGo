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

// In development, accept any localhost/127.0.0.1 origin so the
// frontend works regardless of which port Vite picks.
// In production, only the explicitly-set FRONTEND_URL is allowed.
const allowedOrigins = [
  process.env.FRONTEND_URL,
].filter(Boolean);

const corsOrigin = (origin, callback) => {
  // Allow requests with no origin (e.g. curl, Postman, mobile apps)
  if (!origin) return callback(null, true);

  // Development: permit any localhost or 127.0.0.1 origin
  if (process.env.NODE_ENV !== "production") {
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }
  }

  // Production: check against the explicit allow-list
  if (allowedOrigins.includes(origin)) {
    return callback(null, true);
  }

  callback(new Error(`CORS: origin '${origin}' not allowed`));
};

app.use(cors({ origin: corsOrigin, credentials: true }));
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
