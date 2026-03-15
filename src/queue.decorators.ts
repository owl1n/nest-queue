import { Inject } from "@nestjs/common";
import { EventConsumerOptions } from "./queue.interfaces";
import {
  getQueueToken,
  normalizeQueueName,
  QUEUE_EVENT_METADATA
} from "./queue.types";

export function QueueInjection(name?: string) {
  return Inject(getQueueToken(name));
}

function resolveEventConsumerOptions(
  queueNameOrOptions?: string | EventConsumerOptions
): EventConsumerOptions {
  if (typeof queueNameOrOptions === "string") {
    return {
      queueName: queueNameOrOptions
    };
  }

  return queueNameOrOptions || {};
}

export function EventConsumer(
  eventName: string,
  queueNameOrOptions?: string | EventConsumerOptions
) {
  const options = resolveEventConsumerOptions(queueNameOrOptions);

  const methodDecorator: MethodDecorator = (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ) => {
    if (typeof descriptor.value !== "function") {
      return;
    }

    Reflect.defineMetadata(
      QUEUE_EVENT_METADATA,
      {
        eventName,
        queueName: normalizeQueueName(options.queueName),
        options,
        methodName: propertyKey.toString(),
        callback: descriptor.value
      },
      descriptor.value
    );
  };

  return methodDecorator;
}
