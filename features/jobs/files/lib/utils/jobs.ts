import env from "@configs/env";
import { Queue } from "bullmq";

export interface JobAdapter {
  enqueue(jobName: string, args: unknown[]): Promise<void>;
}

export class BullMQJobAdapter implements JobAdapter {
  private queue: Queue | null = null;

  private getQueue(): Queue {
    if (!this.queue) {
      this.queue = new Queue("irwin-jobs", {
        connection: {
          host: env.redisHost,
          port: env.redisPort,
          maxRetriesPerRequest: null,
        },
      });
    }
    return this.queue;
  }

  async enqueue(jobName: string, args: unknown[]): Promise<void> {
    await this.getQueue().add(jobName, args, { removeOnComplete: true });
  }
}

class InlineJobAdapter implements JobAdapter {
  async enqueue(_jobName: string, _args: unknown[]): Promise<void> {
  }
}

let adapter: JobAdapter;

export function getJobAdapter(): JobAdapter {
  if (!adapter) {
    adapter = new BullMQJobAdapter();
  }
  return adapter;
}
