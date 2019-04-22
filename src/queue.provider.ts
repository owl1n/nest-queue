import * as Bull from "bull";
import { Queue } from "bull";
import {
  FactoryProvider,
  ValueProvider,
  Injectable as InjectableInterface
} from "@nestjs/common/interfaces";
import { Injectable } from "@nestjs/common";
import { MetadataScanner } from "@nestjs/core/metadata-scanner";
import { ModulesContainer } from "@nestjs/core/injector";
import { InstanceWrapper } from "@nestjs/core/injector/instance-wrapper";
import { QUEUE_EVENT_METADATA } from "./queue.types";
import { QueueModuleOptions } from "./queue.interfaces";

@Injectable()
export class QueueProvider {
  constructor(
    private readonly metadataScanner: MetadataScanner,
    private readonly modulesContainer: ModulesContainer
  ) {}

  public static exploreMethodMetadata(
    instance: object,
    instancePrototype: InjectableInterface,
    methodKey: string
  ) {
    const targetCallback = instancePrototype[methodKey];
    const handler = Reflect.getMetadata(QUEUE_EVENT_METADATA, targetCallback);
    if (handler == null) {
      return null;
    }
    return handler;
  }

  public getEventConsumers() {
    const modules = [...this.modulesContainer.values()];
    const componentsMap = modules
      .filter(({ components }) => components.size > 0)
      .map(({ components }) => components);

    const instanceWrappers: InstanceWrapper<InjectableInterface>[] = [];
    componentsMap.forEach(map => {
      const mapKeys = [...map.keys()];
      instanceWrappers.push(
        ...mapKeys.map(key => {
          return map.get(key);
        })
      );
    });

    return instanceWrappers
      .map(({ instance }) => {
        const instancePrototype = Object.getPrototypeOf(instance);
        const scanResult = this.metadataScanner.scanFromPrototype(
          instance,
          instancePrototype,
          method =>
            QueueProvider.exploreMethodMetadata(
              instance,
              instancePrototype,
              method
            )
        );

        return scanResult.map(r => ({ ...r, instance }));
      })
      .reduce((prev, curr) => {
        return prev.concat(curr);
      });
  }

  static createProviders(options: QueueModuleOptions) {
    const valueProvider: ValueProvider = {
      provide: "nestQueueOptions_default",
      useValue: options
    };

    const factoryProvider: FactoryProvider = {
      provide: "nestQueue_default",
      useFactory: options => {
        const queue: Queue = new Bull(options.name, options.connection);

        return queue;
      },
      inject: ["nestQueueOptions_default"]
    };

    return [valueProvider, factoryProvider];
  }
}
