const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { register, login, getMe, updateMe, heartbeat } = require("../controllers/authController");

router.post("/register", register);
router.post("/login", login);
router.get("/me", protect, getMe);
router.patch("/me", protect, updateMe);
router.post("/heartbeat", protect, heartbeat);

module.exports = router;
