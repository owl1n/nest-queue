import { Inject } from "@nestjs/common";
import { QUEUE_EVENT_METADATA } from "./queue.types";

export function QueueInjection(name?: string) {
  return Inject(`nestQueue_${name || "default"}`);
}

export function EventConsumer(eventName: string) {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata(
      QUEUE_EVENT_METADATA,
      {
        eventName,
        target: target.constructor.name,
        methodName: propertyKey,
        callback: descriptor.value
      },
      descriptor.value
    );
  };
}
