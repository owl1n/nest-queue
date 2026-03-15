import { Inject, Injectable } from "@nestjs/common";
import { QueueAdapter } from "./queue.adapters";
import {
  DEFAULT_QUEUE_NAME,
  normalizeQueueName,
  QUEUE_REGISTRY
} from "./queue.types";
import {
  QueueEnqueueOptions,
  QueueHealthSnapshot
} from "./queue.interfaces";

@Injectable()
export class QueueRegistryService {
  constructor(
    @Inject(QUEUE_REGISTRY)
    private readonly queueRegistry: Map<string, QueueAdapter>
  ) {}

  listQueues(): string[] {
    return [...this.queueRegistry.keys()];
  }

  getClient(queueName?: string): unknown {
    return this.getQueueAdapter(queueName).getClient();
  }

  async enqueue(
    eventName: string,
    data: unknown,
    options?: QueueEnqueueOptions
  ): Promise<unknown> {
    const adapter = this.getQueueAdapter(options?.queueName);
    return adapter.add(eventName, data, options?.options);
  }

  async getHealthSnapshot(): Promise<QueueHealthSnapshot[]> {
    const snapshotPromises = [...this.queueRegistry.values()].map(
      async adapter => ({
        name: adapter.name,
        driver: adapter.driver,
        counts: await adapter.getJobCounts()
      })
    );

    return Promise.all(snapshotPromises);
  }

  private getQueueAdapter(queueName?: string): QueueAdapter {
    const normalizedName = normalizeQueueName(queueName || DEFAULT_QUEUE_NAME);
    const adapter = this.queueRegistry.get(normalizedName);

    if (!adapter) {
      throw new Error(`Queue '${normalizedName}' is not configured`);
    }

    return adapter;
  }
}
