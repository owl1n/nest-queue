import * as Bull from "bull";
import { ConnectionOptions as BullMQConnectionOptions } from "bullmq";
import { ModuleMetadata, Type } from "@nestjs/common";

export type QueueDriver = "bull" | "bullmq";

export interface QueueModuleOptions {
  name?: string;
  driver?: QueueDriver;
  connection?: Bull.QueueOptions | BullMQConnectionOptions;
}

export interface QueueModuleOptionsFactory {
  createQueueModuleOptions():
    | QueueModuleOptions
    | Promise<QueueModuleOptions>;
}

export interface QueueModuleAsyncOptions
  extends Pick<ModuleMetadata, "imports"> {
  inject?: any[];
  useClass?: Type<QueueModuleOptionsFactory>;
  useExisting?: Type<QueueModuleOptionsFactory>;
  useFactory?: (...args: any[]) => QueueModuleOptions | Promise<QueueModuleOptions>;
}

export interface QueueEnqueueOptions {
  queueName?: string;
  options?: unknown;
}

export interface QueueJobPolicy {
  attempts?: number;
  backoff?: number | { type: string; delay: number };
  removeOnComplete?: boolean | number;
  removeOnFail?: boolean | number;
}

export interface EventConsumerOptions extends QueueJobPolicy {
  queueName?: string;
  concurrency?: number;
}

export interface QueueHealthSnapshot {
  name: string;
  driver: QueueDriver;
  counts: Record<string, number>;
}
