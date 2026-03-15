import { QueueRegistryService } from "./queue.registry.service";
import { QueueAdapter } from "./queue.adapters";

describe("QueueRegistryService", () => {
  function createAdapter(name: string, driver: "bull" | "bullmq"): QueueAdapter {
    return {
      name,
      driver,
      add: jest.fn(async () => ({ id: 1 })),
      close: async () => undefined,
      getClient: jest.fn(() => ({ name })),
      getJobCounts: jest.fn(async () => ({ waiting: 2, active: 1 })),
      registerConsumer: jest.fn()
    };
  }

  it("enqueues job in selected queue", async () => {
    const defaultAdapter = createAdapter("default", "bull");
    const emailsAdapter = createAdapter("emails", "bullmq");

    const service = new QueueRegistryService(
      new Map([
        ["default", defaultAdapter],
        ["emails", emailsAdapter]
      ])
    );

    await service.enqueue("mail.send", { userId: 10 }, { queueName: "emails" });

    expect(emailsAdapter.add).toHaveBeenCalledWith(
      "mail.send",
      { userId: 10 },
      undefined
    );
    expect(defaultAdapter.add).not.toHaveBeenCalled();
  });

  it("returns health snapshot for all queues", async () => {
    const defaultAdapter = createAdapter("default", "bull");
    const service = new QueueRegistryService(new Map([["default", defaultAdapter]]));

    const snapshot = await service.getHealthSnapshot();

    expect(snapshot).toEqual([
      {
        name: "default",
        driver: "bull",
        counts: {
          waiting: 2,
          active: 1
        }
      }
    ]);
  });

  it("throws if queue is not configured", async () => {
    const service = new QueueRegistryService(new Map());

    await expect(
      service.enqueue("missing.event", { data: true }, { queueName: "missing" })
    ).rejects.toThrow("Queue 'missing' is not configured");
  });
});
