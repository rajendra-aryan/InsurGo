const cron = require("node-cron");
const { runTriggerPipeline } = require("../services/triggerService");
const logger = require("../config/logger");

// Default: every 15 minutes. Override via TRIGGER_CRON env var.
const CRON_SCHEDULE = process.env.TRIGGER_CRON || "*/15 * * * *";

let jobRunning = false;

const startTriggerJob = () => {
  if (!cron.validate(CRON_SCHEDULE)) {
    logger.error(`Invalid TRIGGER_CRON schedule: ${CRON_SCHEDULE}`);
    return;
  }

  logger.info(`⏰ Trigger cron job scheduled: ${CRON_SCHEDULE}`);

  cron.schedule(CRON_SCHEDULE, async () => {
    // Prevent overlapping runs
    if (jobRunning) {
      logger.warn("Trigger job already running — skipping this cycle");
      return;
    }

    jobRunning = true;
    try {
      await runTriggerPipeline();
    } catch (error) {
      logger.error(`Trigger job failed: ${error.message}`);
    } finally {
      jobRunning = false;
    }
  });
};

module.exports = { startTriggerJob };
