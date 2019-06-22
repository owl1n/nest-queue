import { DynamicModule, Global, Module, OnModuleInit } from "@nestjs/common";
import { QueueModuleOptions } from "./queue.interfaces";
import { QueueProvider } from "./queue.provider";
import { MetadataScanner } from "@nestjs/core/metadata-scanner";
import { QueueInjection } from "./queue.decorators";
import { Queue } from "bull";

const defaultOptions: QueueModuleOptions = {
  name: "default",
  connection: {
    redis: {
      port: 6379
    }
  }
};

@Global()
@Module({
  providers: [QueueProvider, MetadataScanner]
})
export class QueueModule implements OnModuleInit {
  constructor(
    private readonly provider: QueueProvider,
    @QueueInjection()
    private readonly queue: Queue
  ) {}

  onModuleInit() {
    const consumers = this.provider.getEventConsumers();

    if (consumers && consumers.length) {
      consumers.forEach(consumer => {
        this.queue.process(consumer.eventName, (...args) =>
          consumer.callback.apply(consumer.instance, ...args)
        );
      });
    }
  }

  static forRoot(options: QueueModuleOptions): DynamicModule {
    const currentOptions: QueueModuleOptions = Object.assign(
      defaultOptions,
      options
    );

    const [valueProvider, factoryProvider] = QueueProvider.createProviders(
      currentOptions
    );

    return {
      module: QueueModule,
      providers: [valueProvider, factoryProvider],
      exports: [factoryProvider]
    };
  }
}
