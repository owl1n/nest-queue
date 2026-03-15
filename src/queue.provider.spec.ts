import "reflect-metadata";
import { DiscoveryService } from "@nestjs/core";
import { MetadataScanner } from "@nestjs/core/metadata-scanner";
import { Queue } from "bull";
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
      process: jest.fn()
    } as unknown as Queue;

    queueProvider.registerConsumers(new Map([["default", queue]]));

    expect(queue.process).toHaveBeenCalledTimes(1);

    const [, handler] = (queue.process as jest.Mock).mock.calls[0] as [
      string,
      (job: unknown, done: () => void) => unknown
    ];

    const done = jest.fn();
    await handler({ id: 1 }, done);

    expect(consumer.calls).toEqual([{ id: 1 }]);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it("ignores consumers with queue names that are not configured", () => {
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
      process: jest.fn()
    } as unknown as Queue;

    queueProvider.registerConsumers(new Map([["default", queue]]));

    expect(queue.process).not.toHaveBeenCalled();
  });
});
