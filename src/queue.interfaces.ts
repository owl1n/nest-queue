import * as Bull from "bull";

export interface QueueModuleOptions {
  name?: string;
  connection: Bull.QueueOptions;
}
