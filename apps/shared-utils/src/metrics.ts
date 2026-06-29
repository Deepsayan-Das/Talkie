import client from 'prom-client';

export const createMetrics = (serviceName: string) => {
    client.collectDefaultMetrics({
        labels: {
            service: serviceName
        }
    })
    const httpRequestCounter = new client.Counter({
        name: 'http_request_total',
        help: 'total no of http requests received',
        labelNames: ['method', 'route', 'status', 'service']
    })

    const httpRequestDuration = new client.Histogram({
        name: 'http_request_duration_ms',
        help: 'HTTP request duration in milliseconds',
        labelNames: ['method', 'route', 'status', 'service'],
        buckets: [10, 50, 100, 200, 500, 1000]
    });

    return { httpRequestCounter, httpRequestDuration, register: client.register };
};