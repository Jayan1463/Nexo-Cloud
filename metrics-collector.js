/**
 * Nexo Cloud - Metrics Collector Script (v1.0.0)
 * 
 * This script simulates a metrics collector running on a server/container.
 * It periodically collects system metrics and sends them to the Nexo API.
 */

const API_ENDPOINT = process.env.NEXO_API_URL || 'http://localhost:3000/api/metrics/ingest';
const PROJECT_ID = process.env.NEXO_PROJECT_ID || 'nexo-prod-cluster';
const RESOURCE_ID = process.env.HOSTNAME || 'node-01';

async function collectMetrics() {
  // In a real scenario, we would use 'os-utils' or 'systeminformation'
  const metrics = [
    { type: 'cpu', value: Math.random() * 100, timestamp: new Date().toISOString(), resourceId: RESOURCE_ID },
    { type: 'memory', value: Math.random() * 100, timestamp: new Date().toISOString(), resourceId: RESOURCE_ID },
    { type: 'network', value: Math.random() * 100, timestamp: new Date().toISOString(), resourceId: RESOURCE_ID },
    { type: 'disk', value: Math.random() * 100, timestamp: new Date().toISOString(), resourceId: RESOURCE_ID },
  ];

  try {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Nexo-Token': process.env.NEXO_API_KEY || 'test-token'
      },
      body: JSON.stringify({
        projectId: PROJECT_ID,
        metrics: metrics
      })
    });

    const result = await response.json();
    console.log(`[${new Date().toISOString()}] Metrics pushed:`, result);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Failed to push metrics:`, error.message);
  }
}

// Run every 10 seconds
console.log(`Nexo Collector started for project: ${PROJECT_ID}`);
setInterval(collectMetrics, 10000);
collectMetrics();
