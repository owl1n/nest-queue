import {
  DynamicModule,
  Global,
  Inject,
  Module,
  OnApplicationShutdown,
  OnModuleInit
} from "@nestjs/common";
import {
  QueueModuleAsyncOptions,
  QueueModuleOptions
} from "./queue.interfaces";
import { QueueAdapter } from "./queue.adapters";
import { QueueRegistryService } from "./queue.registry.service";
import { QueueProvider } from "./queue.provider";
import { DiscoveryModule } from "@nestjs/core";
import { MetadataScanner } from "@nestjs/core/metadata-scanner";
import { getQueueToken, QUEUE_REGISTRY } from "./queue.types";

@Global()
@Module({
  imports: [DiscoveryModule],
  providers: [QueueProvider, QueueRegistryService, MetadataScanner]
})
export class QueueModule implements OnModuleInit, OnApplicationShutdown {
  constructor(
    private readonly provider: QueueProvider,
    @Inject(QUEUE_REGISTRY)
    private readonly queueRegistry: Map<string, QueueAdapter>
  ) {}

  onModuleInit() {
    this.provider.registerConsumers(this.queueRegistry);
  }

  async onApplicationShutdown() {
    await Promise.all(
      [...this.queueRegistry.values()].map(queue => queue.close())
    );
  }

  static forRoot(
    options: QueueModuleOptions | QueueModuleOptions[] = {}
  ): DynamicModule {
    const normalizedOptions = QueueProvider.normalizeOptions(options);
    const providers = QueueProvider.createProviders(normalizedOptions);
    const exportedTokens = providers
      .map(provider => {
        if (typeof provider === "object" && "provide" in provider) {
          return provider.provide;
        }

        return null;
      })
      .filter(
        (token): token is string | symbol | ((...args: any[]) => unknown) =>
          token !== null
      );

    return {
      module: QueueModule,
      providers: [...providers, QueueRegistryService],
      exports: [...exportedTokens, QueueRegistryService]
    };
  }

  static forRootAsync(options: QueueModuleAsyncOptions): DynamicModule {
    const providers = QueueProvider.createAsyncProviders(options);

    return {
      module: QueueModule,
      imports: options.imports || [],
      providers: [...providers, QueueRegistryService],
      exports: [getQueueToken(), QUEUE_REGISTRY, QueueRegistryService]
    };
  }
}
