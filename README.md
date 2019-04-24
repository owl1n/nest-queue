## Queue manager for NestJS applications
Easy for use and installation into you'r projects.

`yarn add nest-queue`

Make sure you have installed redis on your host. For local development you can easily install it using [docker](https://hub.docker.com/_/redis/).

*For better working you need to use `nest` package with `6.*.*` ver.*
#### How to

1) Add new module in your `app.module.ts` file:

    *This module (QueueModule) marked as global.*
    
    ```typescript
    import { Module } from '@nestjs/common';
    import { QueueModule } from 'nest-queue';
    
    @Module({
        imports: [
            QueueModule.forRoot({}),
        ]
    })
    export class AppModule {}
    ```
    
    For first parameter `forRoot` function accept options for current module.
    Settings very simply and have this structure:
    
    ```typescript
    export interface QueueModuleOptions {
       name?: string,
       connection?: Bull.QueueOptions,
    }
    ```
    
    For connection settings you can take help from [Bull documentation](https://optimalbits.github.io/bull/).
    By default connection setting is:
    ```
    connection: {
        redis: {
            port: 6379,
        }
    }
    ```

    It means we will work with `localhost:6379` host.

2) Add queue and handle events

    For add job to queue u need inject a Queue instance into your service or controller.
    For example:

    ```typescript
    import { Controller, Get } from '@nestjs/common'
    import { Queue } from 'bull';
    import { QueueInjection } from 'nest-queue';

    @Controller('test')
    class TestController {
       constructor(
           @QueueInjection() private readonly queue: Queue,
       ) {}
    
       @Get('/')
       index() {
           this.queue.add('testEvent', { data: 1, somedata: 2 });
       }
    }
    ```

    In this case you can manipulate with job adding. You can add delayed call and etc.
    Information about it you can take from [Bull documentation](https://optimalbits.github.io/bull/).

    Anywhere (controllers, services) in your project you can provide event handler for redis calls.
    `@EventConsumer(eventName)` method decorator allows you to work with it. For example:
    
    ```typescript
    import { Job, DoneCallback } from 'bull';
    import { EventConsumer } from 'nest-queue';
    
    class TestService {
        @EventConsumer('testEvent')
        eventHandler(job: Job, done: DoneCallback) {
           // job.data has passed data from queue adding
           done(); // required call to stop job
        }
    }
    ```
    
    *Context (this) in this function equals to TestService prototype with all resolved dependencies*
    
    Function that will provide as event handler receive two arguments `Job` and `DoneCallback`.
    This function calls as bull-processors and you can take help about from bull [Bull documentation](https://optimalbits.github.io/bull/).

#### Future Goals

* Add tests;
* Async module adding;
* Workaround with bull and provide once module for manipulating with jobs;
* Add console commands lika a `queue list` and etc for receiving information about
all processing jobs and allow to restart failed jobs (like a Laravel artisan queue manager).

#### Contributors

* [Maxim Markin](https://github.com/owl1n)
