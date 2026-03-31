require("dotenv").config();
const app = require("./src/app");
const connectDB = require("./src/config/db");
const logger = require("./src/config/logger");
const { startTriggerJob } = require("./src/jobs/triggerJob");

const PORT = process.env.PORT || 5000;

(async () => {
  await connectDB();

  app.listen(PORT, () => {
    logger.info(`🚀 InsurGo server running on port ${PORT}`);
    logger.info(`📋 Environment: ${process.env.NODE_ENV}`);
  });

  // Start the automated disruption-monitoring cron job
  startTriggerJob();
})();
