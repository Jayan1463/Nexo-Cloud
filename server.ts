import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import firebaseConfig from "./firebase-applet-config.json" assert { type: "json" };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: firebaseConfig.projectId,
  });
}

const getDb = () => {
  const app = admin.app();
  if (firebaseConfig.firestoreDatabaseId) {
    return getFirestore(app, firebaseConfig.firestoreDatabaseId);
  }
  return getFirestore(app);
};

async function startServer() {
  const app = express();
  const PORT = 3000;
  const db = getDb();

  app.use(express.json());

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Real Server Metrics Ingestion Endpoint
  app.post("/api/metrics", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized: Missing or invalid API key" });
    }

    const apiKey = authHeader.split(" ")[1];
    const { cpu, memory, network, timestamp } = req.body;

    try {
      // 1. Validate API Key and find server
      const serversRef = db.collection("servers");
      const q = serversRef.where("apiKey", "==", apiKey).limit(1);
      const snapshot = await q.get();

      if (snapshot.empty) {
        return res.status(401).json({ error: "Unauthorized: Invalid API key" });
      }

      const serverDoc = snapshot.docs[0];
      const serverData = serverDoc.data();
      const serverId = serverDoc.id;
      const projectId = serverData.projectId;

      // 2. Update server status and lastSeen
      await serverDoc.ref.update({
        lastSeen: admin.firestore.FieldValue.serverTimestamp(),
        status: "online"
      });

      // 3. Store metric
      const metricRef = serverDoc.ref.collection("metrics").doc();
      const metricData = {
        id: metricRef.id,
        serverId,
        projectId,
        cpu,
        memory,
        network,
        timestamp: timestamp || new Date().toISOString()
      };
      await metricRef.set(metricData);

      // 4. Anomaly Detection & Alerting
      if (cpu > 90 || memory > 90) {
        const alertRef = db.collection("projects").doc(projectId).collection("alerts").doc();
        await alertRef.set({
          id: alertRef.id,
          projectId,
          serverId,
          severity: cpu > 95 ? "critical" : "warning",
          message: `${cpu > 90 ? 'High CPU' : 'High Memory'} detected on ${serverData.name}: ${cpu > 90 ? cpu.toFixed(1) + '%' : memory.toFixed(1) + '%'}`,
          status: "active",
          timestamp: new Date().toISOString()
        });
      }

      res.json({ success: true, serverId });
    } catch (error) {
      console.error("Error ingesting metrics:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Real Server Logs Ingestion Endpoint
  app.post("/api/logs", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized: Missing or invalid API key" });
    }

    const apiKey = authHeader.split(" ")[1];
    const { level, message, service, timestamp } = req.body;

    try {
      // 1. Validate API Key and find server
      const serversRef = db.collection("servers");
      const q = serversRef.where("apiKey", "==", apiKey).limit(1);
      const snapshot = await q.get();

      if (snapshot.empty) {
        return res.status(401).json({ error: "Unauthorized: Invalid API key" });
      }

      const serverDoc = snapshot.docs[0];
      const serverData = serverDoc.data();
      const serverId = serverDoc.id;
      const projectId = serverData.projectId;

      // 2. Store log
      const logRef = db.collection("projects").doc(projectId).collection("logs").doc();
      const logData = {
        id: logRef.id,
        serverId,
        projectId,
        level: level || 'info',
        message: message || '',
        service: service || 'unknown',
        timestamp: timestamp || new Date().toISOString()
      };
      await logRef.set(logData);

      res.json({ success: true, logId: logRef.id });
    } catch (error) {
      console.error("Error ingesting logs:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Email Invitation Endpoint
  app.post("/api/invite", async (req, res) => {
    const { email, orgId, role, invitedBy } = req.body;
    if (!email || !orgId) {
      return res.status(400).json({ error: "Email and orgId are required" });
    }

    try {
      // 1. Create invite in Firestore
      const inviteRef = db.collection("organizations").doc(orgId).collection("invites").doc();
      const inviteData = {
        id: inviteRef.id,
        email,
        orgId,
        role: role || 'viewer',
        invitedBy,
        status: 'pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      };
      await inviteRef.set(inviteData);

      // 2. Simulate sending email
      const emailRef = db.collection("sent_emails").doc();
      await emailRef.set({
        id: emailRef.id,
        to: email,
        subject: `Invitation to join organization on Nexo`,
        body: `You have been invited to join an organization on Nexo. Click here to accept: ${process.env.APP_URL || ''}/accept-invite?id=${inviteRef.id}`,
        status: 'sent',
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      res.json({ success: true, inviteId: inviteRef.id });
    } catch (error) {
      console.error("Error sending invite:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Legacy Metrics Ingestion Endpoint (Simulated)
  app.post("/api/metrics/ingest", (req, res) => {
    const { projectId, metrics } = req.body;
    console.log(`Ingesting metrics for project ${projectId}:`, metrics);
    
    // Simulate anomaly detection
    const anomalies = metrics.filter((m: any) => m.value > 90).map((m: any) => ({
      ...m,
      isAnomaly: true,
      anomalyScore: 95
    }));

    res.json({ 
      success: true, 
      ingestedCount: metrics.length,
      anomaliesDetected: anomalies.length 
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
