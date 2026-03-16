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

### Consumer policy (retry/backoff/concurrency)

`EventConsumer` supports policy options with backward compatibility:

```ts
@EventConsumer("payments.retry", {
  queueName: "payments",
  attempts: 5,
  backoff: { type: "fixed", delay: 1000 },
  concurrency: 3
})
async handlePayment(job: Job, done: DoneCallback) {
  done();
}
```

Supported options:

- `queueName`
- `concurrency`
- `attempts`
- `backoff`
- `removeOnComplete`
- `removeOnFail`

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
- `EventConsumer(eventName, queueNameOrOptions?)`
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

### CI/CD and releases

Repository includes 3 GitHub Actions workflows:

- `CI` (`.github/workflows/ci.yml`)
  - Runs on pull requests and pushes to `master`/feature branches.
  - Executes: `pnpm lint`, `pnpm run build`, `pnpm test`.

- `Release Please` (`.github/workflows/release-please.yml`)
  - Runs on pushes to `master`.
  - Creates/updates a Release PR based on conventional commits.
  - On merge, creates git tag (`vX.Y.Z`) and GitHub Release.

- `Publish to npm` (`.github/workflows/publish.yml`)
  - Runs when a GitHub Release is published.
  - Builds and publishes package to npm with provenance.

#### Required GitHub secrets

- `NPM_TOKEN` — npm automation token with publish rights for `nest-queue`.

#### Recommended commit format

Use conventional commit types so release notes and versioning are meaningful:

- `feat:` for new features (minor bump)
- `fix:` for bug fixes (patch bump)
- `feat!:` or `BREAKING CHANGE:` in body for major bump
- `docs:`, `chore:`, `refactor:` for non-feature updates

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
