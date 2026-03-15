import "reflect-metadata";
import { DiscoveryService } from "@nestjs/core";
import { MetadataScanner } from "@nestjs/core/metadata-scanner";
import { QueueAdapter } from "./queue.adapters";
import { QueueProvider } from "./queue.provider";
import { QUEUE_EVENT_METADATA } from "./queue.types";

describe("QueueProvider", () => {
  it("registers consumers in queue processors", async () => {
    class TestConsumer {
      public calls: unknown[] = [];

      onInvoiceCreated(job: unknown, done: () => void) {
        this.calls.push(job);
        done();
      }
    }

    Reflect.defineMetadata(
      QUEUE_EVENT_METADATA,
      {
        eventName: "invoice.created",
        queueName: "default",
        methodName: "onInvoiceCreated",
        callback: TestConsumer.prototype.onInvoiceCreated
      },
      TestConsumer.prototype.onInvoiceCreated
    );

    const consumer = new TestConsumer();
    const discoveryService = {
      getProviders: () => [{ instance: consumer }]
    } as unknown as DiscoveryService;

    const queueProvider = new QueueProvider(
      new MetadataScanner(),
      discoveryService
    );

    const queue = {
      name: "default",
      driver: "bull",
      close: async () => undefined,
      getClient: () => undefined,
      registerConsumer: jest.fn()
    } as unknown as QueueAdapter;

    await queueProvider.registerConsumers(new Map([["default", queue]]));

    expect(queue.registerConsumer).toHaveBeenCalledTimes(1);

    const [, handler] = (queue.registerConsumer as jest.Mock).mock.calls[0] as [
      string,
      (job: unknown, done: () => void) => unknown
    ];

    const done = jest.fn();
    await handler({ id: 1 }, done);

    expect(consumer.calls).toEqual([{ id: 1 }]);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it("ignores consumers with queue names that are not configured", async () => {
    class TestConsumer {
      onSendMail() {
        return true;
      }
    }

    Reflect.defineMetadata(
      QUEUE_EVENT_METADATA,
      {
        eventName: "mail.send",
        queueName: "emails",
        methodName: "onSendMail",
        callback: TestConsumer.prototype.onSendMail
      },
      TestConsumer.prototype.onSendMail
    );

    const consumer = new TestConsumer();
    const discoveryService = {
      getProviders: () => [{ instance: consumer }]
    } as unknown as DiscoveryService;

    const queueProvider = new QueueProvider(
      new MetadataScanner(),
      discoveryService
    );

    const queue = {
      name: "default",
      driver: "bull",
      close: async () => undefined,
      getClient: () => undefined,
      registerConsumer: jest.fn()
    } as unknown as QueueAdapter;

    await queueProvider.registerConsumers(new Map([["default", queue]]));

    expect(queue.registerConsumer).not.toHaveBeenCalled();
  });

  it("passes consumer options to queue adapter", async () => {
    class TestConsumer {
      onProcess() {
        return true;
      }
    }

    Reflect.defineMetadata(
      QUEUE_EVENT_METADATA,
      {
        eventName: "payments.retry",
        queueName: "default",
        options: {
          attempts: 5,
          backoff: {
            type: "fixed",
            delay: 1000
          },
          concurrency: 3
        },
        methodName: "onProcess",
        callback: TestConsumer.prototype.onProcess
      },
      TestConsumer.prototype.onProcess
    );

    const queueProvider = new QueueProvider(new MetadataScanner(), {
      getProviders: () => [{ instance: new TestConsumer() }]
    } as unknown as DiscoveryService);

    const queue = {
      name: "default",
      driver: "bull",
      close: async () => undefined,
      getClient: () => undefined,
      registerConsumer: jest.fn()
    } as unknown as QueueAdapter;

    await queueProvider.registerConsumers(new Map([["default", queue]]));

    const [, , options] = (queue.registerConsumer as jest.Mock).mock.calls[0];
    expect(options).toMatchObject({
      attempts: 5,
      concurrency: 3
    });
  });

  it("normalizes driver and connection defaults", () => {
    const [bullOptions, bullMqOptions] = QueueProvider.normalizeOptions([
      { name: "default" },
      { name: "events", driver: "bullmq" }
    ]);

    expect(bullOptions).toMatchObject({
      name: "default",
      driver: "bull"
    });

    expect(bullMqOptions).toMatchObject({
      name: "events",
      driver: "bullmq",
      connection: {
        host: "127.0.0.1",
        port: 6379
      }
    });
  });
});
