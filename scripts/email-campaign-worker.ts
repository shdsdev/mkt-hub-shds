import "dotenv/config";
import { processDueEmailCampaigns } from "../src/modules/email-marketing/service";

const campaignId = process.env.EMAIL_CAMPAIGN_WORKER_CAMPAIGN_ID;
const intervalMs = Number(process.env.EMAIL_CAMPAIGN_WORKER_INTERVAL_MS ?? 60_000);

if (!campaignId) {
  throw new Error("EMAIL_CAMPAIGN_WORKER_CAMPAIGN_ID is required for the local worker.");
}
if (!Number.isFinite(intervalMs) || intervalMs < 1_000) {
  throw new Error("EMAIL_CAMPAIGN_WORKER_INTERVAL_MS must be at least 1000 milliseconds.");
}

let running = false;

async function processCampaign() {
  if (running) return;
  running = true;
  try {
    const result = await processDueEmailCampaigns({ campaignId });
    if (result.claimed || result.sent || result.failed) console.log(JSON.stringify(result));
  } catch (error) {
    console.error(error);
  } finally {
    running = false;
  }
}

async function main() {
  await processCampaign();
  const timer = setInterval(processCampaign, intervalMs);

  function stop() {
    clearInterval(timer);
    process.exit(0);
  }

  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

void main();
