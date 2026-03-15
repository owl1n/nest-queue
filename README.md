## nest-queue

Lightweight queue module for NestJS applications with `bull` and `bullmq` drivers.

### Requirements

- Node.js `>=20`
- NestJS `>=11`
- Redis

### Install

```bash
pnpm add nest-queue bull
# or
pnpm add nest-queue bullmq
```

### Quick start

```ts
import { Module } from "@nestjs/common";
import { QueueModule } from "nest-queue";

@Module({
  imports: [
    QueueModule.forRoot({
      connection: {
        redis: {
          host: "127.0.0.1",
          port: 6379
        }
      }
    })
  ]
})
export class AppModule {}
```

### Inject queue and publish jobs

```ts
import { Controller, Post } from "@nestjs/common";
import { Queue } from "bull";
import { QueueInjection } from "nest-queue";

@Controller("jobs")
export class JobsController {
  constructor(@QueueInjection() private readonly queue: Queue) {}

  @Post("send")
  async send() {
    await this.queue.add("mail.send", { userId: 1 });
    return { status: "queued" };
  }
}
```

### Consume jobs

```ts
import { Injectable } from "@nestjs/common";
import { DoneCallback, Job } from "bull";
import { EventConsumer } from "nest-queue";

@Injectable()
export class MailConsumer {
  @EventConsumer("mail.send")
  async handle(job: Job, done: DoneCallback) {
    // process job.data
    done();
  }
}
```

### Multiple queues

```ts
QueueModule.forRoot([
  {
    name: "default",
    connection: { redis: { host: "127.0.0.1", port: 6379 } }
  },
  {
    name: "emails",
    connection: { redis: { host: "127.0.0.1", port: 6380 } }
  }
]);
```

```ts
constructor(@QueueInjection("emails") private readonly emailQueue: Queue) {}

@EventConsumer("mail.send", "emails")
handleEmail(job: Job, done: DoneCallback) {
  done();
}
```

### BullMQ driver

```ts
QueueModule.forRoot({
  name: "events",
  driver: "bullmq",
  connection: {
    host: "127.0.0.1",
    port: 6379
  }
});
```

```ts
import { Queue } from "bullmq";

constructor(@QueueInjection("events") private readonly queue: Queue) {}

@EventConsumer("mail.send", "events")
async handle(job: { data: unknown }) {
  // process BullMQ job
}
```

### Async module registration

```ts
QueueModule.forRootAsync({
  useFactory: async (config: ConfigService) => ({
    connection: {
      redis: {
        host: config.get("REDIS_HOST"),
        port: Number(config.get("REDIS_PORT"))
      }
    }
  }),
  inject: [ConfigService]
});
```

> `forRootAsync` registers the default queue token (`@QueueInjection()`).

### API

- `QueueModule.forRoot(options | options[])`
- `QueueModule.forRootAsync(asyncOptions)`
- `QueueInjection(name?)`
- `EventConsumer(eventName, queueName?)`
- `QueueRegistryService.enqueue(eventName, data, options?)`
- `QueueRegistryService.getHealthSnapshot()`

### Unified producer and health API

```ts
import { Injectable } from "@nestjs/common";
import { QueueRegistryService } from "nest-queue";

@Injectable()
export class QueueFacade {
  constructor(private readonly queues: QueueRegistryService) {}

  async publish() {
    await this.queues.enqueue("mail.send", { userId: 42 }, { queueName: "events" });
  }

  async health() {
    return this.queues.getHealthSnapshot();
  }
}
```

### Development

```bash
pnpm install
pnpm run build
pnpm test
```

### Community roadmap

Current package is intentionally minimal. The most requested next steps for queue modules in service ecosystems are:

- `BullMQ` adapter and compatibility mode for migration from `bull` ✅
- Unified producer API and queue health snapshot service ✅
- Native retry/backoff policies via decorators/config presets
- Per-handler concurrency + rate limiting in decorator options
- First-class telemetry (`OpenTelemetry` traces, metrics, queue health probes)
- Admin primitives (`pause/resume/drain`, dead-letter flow, replay failed jobs)
- Typed payload contracts for producer/consumer pairs
- Outbox/inbox patterns for exactly-once-like semantics in distributed systems
- Better DevEx around local testing (in-memory adapter / test harness)
