import * as Bull from "bull";
import { Queue as BullQueue } from "bull";
import {
  ConnectionOptions as BullMQConnectionOptions,
  JobsOptions as BullMQJobsOptions,
  Job as BullMQJob,
  Queue as BullMQQueue,
  Worker as BullMQWorker
} from "bullmq";
import { QueueDriver } from "./queue.interfaces";

type QueueHandler = (job: unknown, done: () => void) => unknown;

export interface QueueAdapter {
  readonly name: string;
  readonly driver: QueueDriver;

  getClient(): unknown;
  add(eventName: string, data: unknown, options?: unknown): Promise<unknown>;
  getJobCounts(): Promise<Record<string, number>>;
  registerConsumer(eventName: string, handler: QueueHandler): void;
  close(): Promise<void>;
}

export class BullQueueAdapter implements QueueAdapter {
  public readonly driver: QueueDriver = "bull";

  constructor(
    public readonly name: string,
    private readonly queue: BullQueue
  ) {}

  getClient(): BullQueue {
    return this.queue;
  }

  async add(eventName: string, data: unknown, options?: unknown): Promise<unknown> {
    return this.queue.add(eventName, data, options as Bull.JobOptions);
  }

  async getJobCounts(): Promise<Record<string, number>> {
    const counts = await this.queue.getJobCounts();
    return counts as unknown as Record<string, number>;
  }

  registerConsumer(eventName: string, handler: QueueHandler) {
    this.queue.process(eventName, (job, done) => handler(job, done));
  }

  async close() {
    await this.queue.close();
  }
}

export class BullMQQueueAdapter implements QueueAdapter {
  public readonly driver: QueueDriver = "bullmq";
  private worker?: BullMQWorker;
  private handlers = new Map<string, QueueHandler>();

  constructor(
    public readonly name: string,
    private readonly queue: BullMQQueue,
    private readonly connection: BullMQConnectionOptions
  ) {}

  getClient(): BullMQQueue {
    return this.queue;
  }

  async add(eventName: string, data: unknown, options?: unknown): Promise<unknown> {
    return this.queue.add(eventName, data, options as BullMQJobsOptions);
  }

  async getJobCounts(): Promise<Record<string, number>> {
    const counts = await this.queue.getJobCounts();
    return counts as unknown as Record<string, number>;
  }

  registerConsumer(eventName: string, handler: QueueHandler) {
    this.handlers.set(eventName, handler);

    if (this.worker) {
      return;
    }

    this.worker = new BullMQWorker(
      this.name,
      async (job: BullMQJob) => {
        const consumer = this.handlers.get(job.name);

        if (!consumer) {
          throw new Error(`No consumer registered for event '${job.name}'`);
        }

        return Promise.resolve(consumer(job, () => undefined));
      },
      {
        connection: this.connection
      }
    );
  }

  async close() {
    if (this.worker) {
      await this.worker.close();
    }
    await this.queue.close();
  }
}

export function createQueueAdapter(options: {
  name: string;
  driver: QueueDriver;
  connection: unknown;
}): QueueAdapter {
  if (options.driver === "bullmq") {
    const connection = options.connection as BullMQConnectionOptions;
    const queue = new BullMQQueue(options.name, { connection });
    return new BullMQQueueAdapter(options.name, queue, connection);
  }

  const queue = new Bull(options.name, options.connection as Bull.QueueOptions);
  return new BullQueueAdapter(options.name, queue);
}
