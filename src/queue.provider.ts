import * as Bull from "bull";
import {
  FactoryProvider,
  Injectable,
  Provider,
  Type,
  ValueProvider
} from "@nestjs/common";
import { DiscoveryService } from "@nestjs/core";
import { MetadataScanner } from "@nestjs/core/metadata-scanner";
import {
  EventConsumerOptions,
  QueueModuleAsyncOptions,
  QueueDriver,
  QueueModuleOptions,
  QueueModuleOptionsFactory
} from "./queue.interfaces";
import { createQueueAdapter, QueueAdapter } from "./queue.adapters";
import {
  DEFAULT_QUEUE_NAME,
  getQueueAdapterToken,
  getQueueToken,
  normalizeQueueName,
  QUEUE_EVENT_METADATA,
  QUEUE_REGISTRY
} from "./queue.types";

interface EventConsumerMetadata {
  eventName: string;
  queueName: string;
  options?: EventConsumerOptions;
  methodName: string;
  callback: (...args: any[]) => any;
}

interface EventConsumerDescriptor extends EventConsumerMetadata {
  instance: Record<string, any>;
}

interface NormalizedQueueModuleOptions {
  name: string;
  driver: QueueDriver;
  connection: unknown;
}

const BASE_CONNECTION: Bull.QueueOptions = {
  redis: {
    port: 6379
  }
};

const BASE_BULLMQ_CONNECTION: Record<string, unknown> = {
  host: "127.0.0.1",
  port: 6379
};

function normalizeBullConnection(
  connection?: unknown
): Bull.QueueOptions {
  return {
    ...BASE_CONNECTION,
    ...((connection || {}) as Bull.QueueOptions)
  };
}

function normalizeBullMQConnection(
  connection?: unknown
): Record<string, unknown> {
  return {
    ...BASE_BULLMQ_CONNECTION,
    ...((connection || {}) as Record<string, unknown>)
  };
}

const ASYNC_OPTIONS_TOKEN = "NEST_QUEUE_ASYNC_OPTIONS";

@Injectable()
export class QueueProvider {
  constructor(
    private readonly metadataScanner: MetadataScanner,
    private readonly discoveryService: DiscoveryService
  ) {}

  public static exploreMethodMetadata(instancePrototype: object, methodKey: string) {
    const targetCallback = (instancePrototype as any)[methodKey];
    const handler = Reflect.getMetadata(QUEUE_EVENT_METADATA, targetCallback);

    if (handler == null) {
      return null;
    }

    return {
      ...handler,
      methodName: methodKey,
      callback: targetCallback
    } as EventConsumerMetadata;
  }

  public async registerConsumers(queues: Map<string, QueueAdapter>) {
    const consumers = this.getEventConsumers();

    consumers.forEach(consumer => {
      const queue = queues.get(consumer.queueName);

      if (!queue) {
        return;
      }

      queue.registerConsumer(consumer.eventName, (...args: any[]) => {
        const method = consumer.instance[consumer.methodName];

        if (typeof method !== "function") {
          return undefined;
        }

        return method.apply(consumer.instance, args);
      }, consumer.options);
    });

    const finalizePromises = [...queues.values()].map(queue => {
      if (typeof queue.finalizeConsumers === "function") {
        return queue.finalizeConsumers();
      }

      return Promise.resolve();
    });

    await Promise.all(finalizePromises);
  }

  public getEventConsumers(): EventConsumerDescriptor[] {
    const providers = this.discoveryService.getProviders();

    return providers
      .filter(wrapper => Boolean(wrapper?.instance))
      .map(wrapper => wrapper.instance as Record<string, any>)
      .map((instance: Record<string, any>) => {
        const instancePrototype = Object.getPrototypeOf(instance || {});

        if (!instancePrototype) {
          return [] as EventConsumerDescriptor[];
        }

        const scanResult = this.metadataScanner.scanFromPrototype(
          instance,
          instancePrototype,
          (method: string) =>
            QueueProvider.exploreMethodMetadata(instancePrototype, method)
        );

        return (scanResult.filter(Boolean) as EventConsumerMetadata[]).map(
          consumer => ({
            ...consumer,
            instance
          })
        );
      })
      .reduce((prev, curr) => {
        return prev.concat(curr);
      }, [] as EventConsumerDescriptor[]);
  }

  static normalizeOptions(
    options: QueueModuleOptions | QueueModuleOptions[] = {}
  ): NormalizedQueueModuleOptions[] {
    const values = Array.isArray(options) ? options : [options];

    return values.map(value => ({
      name: normalizeQueueName(value.name),
      driver: value.driver || "bull",
      connection:
        (value.driver || "bull") === "bullmq"
          ? normalizeBullMQConnection(value.connection)
          : normalizeBullConnection(value.connection)
    }));
  }

  static createProviders(options: NormalizedQueueModuleOptions[]): Provider[] {
    const valueProviders: ValueProvider[] = options.map(option => ({
      provide: `nestQueueOptions_${option.name}`,
      useValue: option
    }));

    const adapterProviders: FactoryProvider[] = options.map(option => ({
      provide: getQueueAdapterToken(option.name),
      useFactory: (currentOptions: NormalizedQueueModuleOptions) => {
        return createQueueAdapter(currentOptions);
      },
      inject: [`nestQueueOptions_${option.name}`]
    }));

    const queueProviders: FactoryProvider[] = options.map(option => ({
      provide: getQueueToken(option.name),
      useFactory: (adapter: QueueAdapter) => adapter.getClient(),
      inject: [getQueueAdapterToken(option.name)]
    }));

    const registryProvider: FactoryProvider = {
      provide: QUEUE_REGISTRY,
      useFactory: (...adapters: QueueAdapter[]) => {
        return options.reduce((result, option, index) => {
          const adapter = adapters[index];
          if (adapter) {
            result.set(option.name || DEFAULT_QUEUE_NAME, adapter);
          }
          return result;
        }, new Map<string, QueueAdapter>());
      },
      inject: options.map(option => getQueueAdapterToken(option.name))
    };

    return [
      ...valueProviders,
      ...adapterProviders,
      ...queueProviders,
      registryProvider
    ];
  }

  static createAsyncProviders(options: QueueModuleAsyncOptions): Provider[] {
    const asyncOptionsProvider = this.createAsyncOptionsProvider(options);

    const adapterProvider: FactoryProvider = {
      provide: getQueueAdapterToken(DEFAULT_QUEUE_NAME),
      useFactory: (queueOptions: QueueModuleOptions) => {
        const [normalized] = this.normalizeOptions(queueOptions);
        if (!normalized) {
          throw new Error("Queue options are not configured");
        }
        return createQueueAdapter(normalized);
      },
      inject: [ASYNC_OPTIONS_TOKEN]
    };

    const queueProvider: FactoryProvider = {
      provide: getQueueToken(DEFAULT_QUEUE_NAME),
      useFactory: (adapter: QueueAdapter) => adapter.getClient(),
      inject: [getQueueAdapterToken(DEFAULT_QUEUE_NAME)]
    };

    const registryProvider: FactoryProvider = {
      provide: QUEUE_REGISTRY,
      useFactory: (adapter: QueueAdapter) => {
        return new Map<string, QueueAdapter>([[DEFAULT_QUEUE_NAME, adapter]]);
      },
      inject: [getQueueAdapterToken(DEFAULT_QUEUE_NAME)]
    };

    const providers: Provider[] = [
      asyncOptionsProvider,
      adapterProvider,
      queueProvider,
      registryProvider
    ];

    if (options.useClass) {
      providers.push({
        provide: options.useClass,
        useClass: options.useClass
      });
    }

    return providers;
  }

  static createAsyncOptionsProvider(options: QueueModuleAsyncOptions): Provider {
    if (options.useFactory) {
      return {
        provide: ASYNC_OPTIONS_TOKEN,
        useFactory: async (...args: any[]) => {
          const queueOptions = await options.useFactory!(...args);
          return this.normalizeOptions(queueOptions)[0];
        },
        inject: options.inject || []
      };
    }

    const injectTarget = options.useExisting || options.useClass;

    if (!injectTarget) {
      throw new Error(
        "Invalid async options: useFactory, useClass or useExisting must be provided"
      );
    }

    return {
      provide: ASYNC_OPTIONS_TOKEN,
      useFactory: async (optionsFactory: QueueModuleOptionsFactory) => {
        const queueOptions = await optionsFactory.createQueueModuleOptions();
        return this.normalizeOptions(queueOptions)[0];
      },
      inject: [injectTarget as Type<QueueModuleOptionsFactory>]
    };
  }
}
