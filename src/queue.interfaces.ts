import * as Bull from "bull";
import { ModuleMetadata, Type } from "@nestjs/common";

export interface QueueModuleOptions {
  name?: string;
  connection?: Bull.QueueOptions;
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
