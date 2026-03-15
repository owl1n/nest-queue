import * as Bull from "bull";
import { Queue } from "bull";
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
  QueueModuleAsyncOptions,
  QueueModuleOptions,
  QueueModuleOptionsFactory
} from "./queue.interfaces";
import {
  DEFAULT_QUEUE_NAME,
  getQueueToken,
  normalizeQueueName,
  QUEUE_EVENT_METADATA,
  QUEUE_REGISTRY
} from "./queue.types";

interface EventConsumerMetadata {
  eventName: string;
  queueName: string;
  methodName: string;
  callback: (...args: any[]) => any;
}

interface EventConsumerDescriptor extends EventConsumerMetadata {
  instance: Record<string, any>;
}

interface NormalizedQueueModuleOptions {
  name: string;
  connection: Bull.QueueOptions;
}

const BASE_CONNECTION: Bull.QueueOptions = {
  redis: {
    port: 6379
  }
};

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

  public registerConsumers(queues: Map<string, Queue>) {
    const consumers = this.getEventConsumers();

    consumers.forEach(consumer => {
      const queue = queues.get(consumer.queueName);

      if (!queue) {
        return;
      }

      queue.process(consumer.eventName, (...args: any[]) => {
        const method = consumer.instance[consumer.methodName];

        if (typeof method !== "function") {
          return undefined;
        }

        return method.apply(consumer.instance, args);
      });
    });
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
      connection: {
        ...BASE_CONNECTION,
        ...value.connection
      }
    }));
  }

  static createProviders(options: NormalizedQueueModuleOptions[]): Provider[] {
    const valueProviders: ValueProvider[] = options.map(option => ({
      provide: `nestQueueOptions_${option.name}`,
      useValue: option
    }));

    const queueProviders: FactoryProvider[] = options.map(option => ({
      provide: getQueueToken(option.name),
      useFactory: (currentOptions: NormalizedQueueModuleOptions) => {
        return new Bull(currentOptions.name, currentOptions.connection);
      },
      inject: [`nestQueueOptions_${option.name}`]
    }));

    const registryProvider: FactoryProvider = {
      provide: QUEUE_REGISTRY,
      useFactory: (...queues: Queue[]) => {
        return options.reduce((result, option, index) => {
          const queue = queues[index];
          if (queue) {
            result.set(option.name || DEFAULT_QUEUE_NAME, queue);
          }
          return result;
        }, new Map<string, Queue>());
      },
      inject: options.map(option => getQueueToken(option.name))
    };

    return [...valueProviders, ...queueProviders, registryProvider];
  }

  static createAsyncProviders(options: QueueModuleAsyncOptions): Provider[] {
    const asyncOptionsProvider = this.createAsyncOptionsProvider(options);

    const queueProvider: FactoryProvider = {
      provide: getQueueToken(DEFAULT_QUEUE_NAME),
      useFactory: (queueOptions: QueueModuleOptions) => {
        const [normalized] = this.normalizeOptions(queueOptions);
        if (!normalized) {
          throw new Error("Queue options are not configured");
        }
        return new Bull(normalized.name, normalized.connection);
      },
      inject: [ASYNC_OPTIONS_TOKEN]
    };

    const registryProvider: FactoryProvider = {
      provide: QUEUE_REGISTRY,
      useFactory: (queue: Queue) => {
        return new Map<string, Queue>([[DEFAULT_QUEUE_NAME, queue]]);
      },
      inject: [getQueueToken(DEFAULT_QUEUE_NAME)]
    };

    const providers: Provider[] = [
      asyncOptionsProvider,
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
