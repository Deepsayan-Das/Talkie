const http = require('http');

const options = {
    hostname: '127.0.0.1',
    port: 3001,
    path: '/api/v1/auth/register',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    }
};

const body = JSON.stringify({ email: 'nodetest_' + Date.now() + '@example.com', password: 'Test@1234' });

console.log('Testing direct auth-service at', options.hostname + ':' + options.port + options.path);

const req = http.request(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        console.log('STATUS:', res.statusCode);
        console.log('BODY:', data);
        process.exit(0);
    });
});

req.on('error', (e) => {
    console.error('ERROR:', e.message);
    process.exit(1);
});

req.setTimeout(10000, () => {
    console.error('TIMEOUT: request timed out after 10s');
    req.destroy();
    process.exit(1);
});

req.write(body);
req.end();
