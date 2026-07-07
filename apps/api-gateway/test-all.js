const http = require('http');

function makeRequest(port, path, label) {
    return new Promise((resolve) => {
        const options = {
            hostname: '127.0.0.1',
            port,
            path,
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Origin': 'http://localhost:3000' }
        };
        const body = JSON.stringify({ email: `test_${label}_${Date.now()}@example.com`, password: 'Test@1234' });
        console.log(`\n[${label}] POST http://127.0.0.1:${port}${path}`);
        
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                console.log(`[${label}] STATUS:`, res.statusCode);
                console.log(`[${label}] BODY:`, data.substring(0, 300));
                resolve(res.statusCode);
            });
        });
        req.on('error', (e) => { console.error(`[${label}] ERROR:`, e.message); resolve(null); });
        req.setTimeout(10000, () => { console.error(`[${label}] TIMEOUT`); req.destroy(); resolve(null); });
        req.write(body);
        req.end();
    });
}

async function run() {
    // Test 1: Direct to auth service
    await makeRequest(3001, '/api/v1/auth/register', 'DIRECT');
    
    // Test 2: Through gateway
    await makeRequest(3003, '/auth/register', 'GATEWAY');
    
    // Test 3: Through test proxy on 9998
    await makeRequest(9998, '/auth/register', 'TEST-PROXY');
}

run().then(() => process.exit(0));
