const si = require('systeminformation');
const axios = require('axios');

const args = process.argv.slice(2).reduce((acc, arg) => {
  const [key, value] = arg.replace('--', '').split('=');
  acc[key] = value;
  return acc;
}, {});

const API_KEY = args.key;
const SERVER_ID = args.serverId;
const API_URL = args.apiUrl || 'https://ais-dev-tkcqjkk66kstqp2ok3pu3x-394213884863.asia-southeast1.run.app/api/metrics';

if (!API_KEY || !SERVER_ID) {
  console.error('Usage: node agent.js --key=YOUR_API_KEY --serverId=YOUR_SERVER_ID [--apiUrl=API_URL]');
  process.exit(1);
}

console.log(`🚀 Nexo Cloud Agent starting...`);
console.log(`📡 Target: ${API_URL}`);
console.log(`🆔 Server ID: ${SERVER_ID}`);

async function collectAndSend() {
  try {
    const [cpu, mem, net] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.networkStats()
    ]);

    const metrics = {
      cpu: Math.round(cpu.currentLoad),
      memory: Math.round((mem.active / mem.total) * 100),
      network: Math.round((net[0].rx_sec + net[0].tx_sec) / 1024), // KB/s
      timestamp: new Date().toISOString()
    };

    await axios.post(API_URL, metrics, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(`[${new Date().toLocaleTimeString()}] Metrics sent successfully: CPU ${metrics.cpu}% | MEM ${metrics.memory}%`);
  } catch (error) {
    console.error(`❌ Error sending metrics:`, error.message);
  }
}

// Send every 5 seconds
setInterval(collectAndSend, 5000);
collectAndSend();
