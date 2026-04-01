import openNextWorkerModule, {
  BucketCachePurge,
  DOQueueHandler,
  DOShardedTagCache,
} from "./.open-next/worker.js";

import { runAutomationScheduler } from "./src/lib/outreach-automation";
import { setCloudflareBindings } from "./src/lib/cloudflare";

const worker = openNextWorkerModule;

export { BucketCachePurge, DOQueueHandler, DOShardedTagCache };

export default {
  async fetch(request, env, ctx) {
    setCloudflareBindings(env);
    return worker.fetch(request, env, ctx);
  },
  async scheduled(_controller, env, ctx) {
    setCloudflareBindings(env);
    ctx.waitUntil(
      runAutomationScheduler().catch((error) => {
        console.error("Automation cron failed:", error);
      }),
    );
  },
};
