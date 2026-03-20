/**
 * workers/startWorker.ts — Entry point to run the Fabric BullMQ worker.
 *
 * Usage:
 *   npx ts-node workers/startWorker.ts
 *   # or
 *   npx tsx workers/startWorker.ts
 *
 * This file simply imports fabricWorker.ts which starts the worker
 * as a side effect.
 */

import './fabricWorker';
