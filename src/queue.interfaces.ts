import * as Bull from "bull";

export interface QueueModuleOptions {
  name?: string;
  connection?: Bull.QueueOptions;
  consumers?: Array<Object | null>;
  providers?: Array<Object | null>;
}
