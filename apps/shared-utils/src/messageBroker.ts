import * as amqplib from 'amqplib';
import { createLogger } from './logger';

const EXCHANGE_NAME = 'talkie.events';

interface MessageBroker {
    publish(routingKey: string, payload: object): Promise<void>;
    consume(
        queueName: string,
        bindingKeys: string[],
        handler: (payload: any, ack: () => void, nack: () => void) => Promise<void>
    ): Promise<void>;
}

export async function createMessageBroker(serviceName: string): Promise<MessageBroker> {
    const logger = createLogger(serviceName);
    const url = process.env.RABBITMQ_URL || 'amqp://localhost:5672';

    // Retry connection on boot — RabbitMQ may not be ready yet when this service starts.
    let connection: any;
    const MAX_CONNECT_RETRIES = 5;
    let attempt = 0;

    while (true) {
        try {
            connection = await amqplib.connect(url);
            logger.info('Connected to RabbitMQ');
            break;
        } catch (err) {
            attempt++;
            if (attempt >= MAX_CONNECT_RETRIES) {
                logger.error('Failed to connect to RabbitMQ after retries', err);
                throw err; // let the service fail loudly at boot if it truly can't connect
            }
            logger.warn(`RabbitMQ connect failed, retry ${attempt}/${MAX_CONNECT_RETRIES}`);
            await new Promise((r) => setTimeout(r, attempt * 1000));
        }
    }

    const channel = await connection.createChannel();
    await channel.assertExchange(EXCHANGE_NAME, 'topic', { durable: true });

    return {
        async publish(routingKey: string, payload: object) {
            channel.publish(
                EXCHANGE_NAME,
                routingKey,
                Buffer.from(JSON.stringify(payload)),
                { persistent: true } // survive a RabbitMQ restart — decided in Step 5
            );
        },

        async consume(queueName, bindingKeys, handler) {
            await channel.assertQueue(queueName, { durable: true });
            for (const key of bindingKeys) {
                await channel.bindQueue(queueName, EXCHANGE_NAME, key);
            }
            await channel.prefetch(1); // decided in Step 6 — fair dispatch, one at a time

            channel.consume(queueName, async (msg: amqplib.ConsumeMessage | null) => {
                if (!msg) return;
                const payload = JSON.parse(msg.content.toString());
                await handler(
                    payload,
                    () => channel.ack(msg),
                    () => channel.ack(msg) // "nack" here still acks per our retry-then-drop decision — see note below
                );
            });
        },
    };
}