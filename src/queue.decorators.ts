import { Inject } from "@nestjs/common";
import {
  getQueueToken,
  normalizeQueueName,
  QUEUE_EVENT_METADATA
} from "./queue.types";

export function QueueInjection(name?: string) {
  return Inject(getQueueToken(name));
}

export function EventConsumer(eventName: string, queueName?: string) {
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
        queueName: normalizeQueueName(queueName),
        methodName: propertyKey.toString(),
        callback: descriptor.value
      },
      descriptor.value
    );
  };

  return methodDecorator;
}
