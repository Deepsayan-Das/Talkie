const http = require('http');

async function testEndpoint() {
    try {
        console.log("Logging in...");
        const loginRes = await fetch("http://localhost:3003/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "gaminghunter710@gmail.com", password: "deepsay0006D" })
        });

        if (!loginRes.ok) {
            console.error("Login failed:", loginRes.status, await loginRes.text());
            return;
        }

        const loginData = await loginRes.json();
        console.log("Login successful.");
        const token = loginData.data?.accessToken || loginData.token || loginData.accessToken;
        if (!token) {
            console.error("No token found in response:", loginData);
            return;
        }

        console.log("Fetching TURN credentials...");
        const turnRes = await fetch("http://localhost:3003/chat/turn-credentials", {
            method: "GET",
            headers: { 
                "Authorization": `Bearer ${token}` 
            }
        });

        if (!turnRes.ok) {
            console.error("TURN fetch failed:", turnRes.status, await turnRes.text());
            return;
        }

        const turnData = await turnRes.json();
        console.log("TURN Credentials Response:", JSON.stringify(turnData, null, 2));

    } catch (e) {
        console.error("Error:", e);
    }
}

testEndpoint();
