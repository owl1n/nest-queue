import "reflect-metadata";
import { EventConsumer } from "./queue.decorators";
import {
  DEFAULT_QUEUE_NAME,
  QUEUE_EVENT_METADATA
} from "./queue.types";

describe("EventConsumer", () => {
  it("stores metadata with default queue name", () => {
    class TestConsumer {
      @EventConsumer("user.created")
      handle() {
        return true;
      }
    }

    const callback = TestConsumer.prototype.handle;
    const metadata = Reflect.getMetadata(QUEUE_EVENT_METADATA, callback);

    expect(metadata).toMatchObject({
      eventName: "user.created",
      queueName: DEFAULT_QUEUE_NAME,
      methodName: "handle"
    });
    expect(typeof metadata.callback).toBe("function");
  });

  it("stores metadata with explicit queue name", () => {
    class TestConsumer {
      @EventConsumer("mail.send", "emails")
      handle() {
        return true;
      }
    }

    const callback = TestConsumer.prototype.handle;
    const metadata = Reflect.getMetadata(QUEUE_EVENT_METADATA, callback);

    expect(metadata).toMatchObject({
      eventName: "mail.send",
      queueName: "emails",
      methodName: "handle"
    });
  });

  it("stores metadata with policy options", () => {
    class TestConsumer {
      @EventConsumer("payments.retry", {
        queueName: "payments",
        attempts: 5,
        backoff: {
          type: "fixed",
          delay: 1000
        },
        concurrency: 3
      })
      handle() {
        return true;
      }
    }

    const callback = TestConsumer.prototype.handle;
    const metadata = Reflect.getMetadata(QUEUE_EVENT_METADATA, callback);

    expect(metadata).toMatchObject({
      eventName: "payments.retry",
      queueName: "payments",
      methodName: "handle",
      options: {
        queueName: "payments",
        attempts: 5,
        concurrency: 3
      }
    });
  });
});
