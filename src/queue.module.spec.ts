import { QueueModule } from "./queue.module";
import { getQueueToken, QUEUE_REGISTRY } from "./queue.types";

describe("QueueModule", () => {
  it("creates providers for multiple queues", () => {
    const dynamicModule = QueueModule.forRoot([
      { name: "default" },
      { name: "emails" }
    ]);

    const providers = (dynamicModule.providers || []) as Array<{
      provide?: string;
    }>;

    const providerTokens = providers
      .map(provider => provider.provide)
      .filter(Boolean);

    expect(providerTokens).toContain(getQueueToken("default"));
    expect(providerTokens).toContain(getQueueToken("emails"));
    expect(providerTokens).toContain(QUEUE_REGISTRY);
  });

  it("creates async registration with default queue token", () => {
    const dynamicModule = QueueModule.forRootAsync({
      useFactory: async () => ({
        connection: {
          redis: {
            port: 6379
          }
        }
      })
    });

    expect(dynamicModule.exports).toEqual([
      getQueueToken("default"),
      QUEUE_REGISTRY
    ]);
  });
});
