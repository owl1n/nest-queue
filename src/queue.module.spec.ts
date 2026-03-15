import { QueueModule } from "./queue.module";
import { QueueRegistryService } from "./queue.registry.service";
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

    expect(dynamicModule.exports).toContain(getQueueToken("default"));
    expect(dynamicModule.exports).toContain(QUEUE_REGISTRY);
    expect(dynamicModule.exports).toContain(QueueRegistryService);
  });

  it("supports bullmq driver options", () => {
    const dynamicModule = QueueModule.forRoot({
      name: "events",
      driver: "bullmq",
      connection: {
        host: "127.0.0.1",
        port: 6379
      }
    });

    const providers = (dynamicModule.providers || []) as Array<{
      provide?: string;
      useValue?: {
        name?: string;
        driver?: string;
      };
    }>;

    const optionsProvider = providers.find(
      provider => provider.provide === "nestQueueOptions_events"
    );

    expect(optionsProvider?.useValue?.driver).toBe("bullmq");
  });
});
