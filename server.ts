import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import crypto from "crypto";
import dotenv from "dotenv";
import firebaseConfig from "./firebase-applet-config.json" assert { type: "json" };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config();

function parseServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed.private_key === "string") {
      parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
    }
    return parsed;
  } catch {
    return null;
  }
}

// Initialize Firebase Admin
if (!admin.apps.length) {
  const serviceAccount = parseServiceAccount();
  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID || firebaseConfig.projectId,
    });
  } else {
    admin.initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID || firebaseConfig.projectId,
    });
  }
}

const getDb = () => {
  const app = admin.app();
  const dbId = process.env.FIREBASE_DATABASE_ID || firebaseConfig.firestoreDatabaseId;
  if (dbId) {
    return getFirestore(app, dbId);
  }
  return getFirestore(app);
};

function isMissingGoogleCredentials(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("Could not load the default credentials");
}

function sendApiError(res: express.Response, error: unknown, context: string) {
  console.error(`Error in ${context}:`, error);
  if (isMissingGoogleCredentials(error)) {
    return res.status(503).json({
      error: "Firebase Admin credentials are not configured on this server.",
    });
  }
  return res.status(500).json({ error: "Internal server error" });
}

async function deleteDocs(
  db: FirebaseFirestore.Firestore,
  docs: FirebaseFirestore.QueryDocumentSnapshot[],
) {
  if (docs.length === 0) return;
  const chunkSize = 400;
  for (let i = 0; i < docs.length; i += chunkSize) {
    const batch = db.batch();
    const chunk = docs.slice(i, i + chunkSize);
    for (const docSnap of chunk) {
      batch.delete(docSnap.ref);
    }
    await batch.commit();
  }
}

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
    const cpuValue = Number(cpu);
    const memoryValue = Number(memory);
    const networkValue = Number(network);
    if (!Number.isFinite(cpuValue) || cpuValue < 0 || cpuValue > 100) {
      return res.status(400).json({ error: "cpu must be a number between 0 and 100" });
    }
    if (!Number.isFinite(memoryValue) || memoryValue < 0 || memoryValue > 100) {
      return res.status(400).json({ error: "memory must be a number between 0 and 100" });
    }
    if (!Number.isFinite(networkValue) || networkValue < 0) {
      return res.status(400).json({ error: "network must be a non-negative number" });
    }

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
        cpu: cpuValue,
        memory: memoryValue,
        network: networkValue,
        timestamp: timestamp || new Date().toISOString()
      };
      await metricRef.set(metricData);

      // 4. Anomaly Detection & Alerting
      if (cpuValue > 90 || memoryValue > 90) {
        const alertRef = db.collection("projects").doc(projectId).collection("alerts").doc();
        await alertRef.set({
          id: alertRef.id,
          projectId,
          serverId,
          severity: cpuValue > 95 ? "critical" : "warning",
          message: `${cpuValue > 90 ? 'High CPU' : 'High Memory'} detected on ${serverData.name}: ${cpuValue > 90 ? cpuValue.toFixed(1) + '%' : memoryValue.toFixed(1) + '%'}`,
          status: "active",
          timestamp: new Date().toISOString()
        });
      }

      res.json({ success: true, serverId });
    } catch (error) {
      return sendApiError(res, error, "metrics ingestion");
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
    const normalizedLevel = level === "info" || level === "warn" || level === "error" ? level : "info";
    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "message is required" });
    }
    if (typeof service !== "string" || !service.trim()) {
      return res.status(400).json({ error: "service is required" });
    }

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
        level: normalizedLevel,
        message: message.trim(),
        service: service.trim(),
        timestamp: timestamp || new Date().toISOString()
      };
      await logRef.set(logData);

      res.json({ success: true, logId: logRef.id });
    } catch (error) {
      return sendApiError(res, error, "logs ingestion");
    }
  });

  // Email Invitation Endpoint
  app.post("/api/invite", async (req, res) => {
    const { email, orgId, role, invitedBy } = req.body;
    if (!email || !orgId) {
      return res.status(400).json({ error: "Email and orgId are required" });
    }
    if (!invitedBy || typeof invitedBy !== "string") {
      return res.status(400).json({ error: "invitedBy is required" });
    }

    try {
      const normalizedEmail = String(email).trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        return res.status(400).json({ error: "Invalid email format" });
      }
      if (normalizedEmail.length > 254) {
        return res.status(400).json({ error: "Email is too long" });
      }
      const normalizedRole = role === "admin" || role === "developer" || role === "viewer" ? role : "viewer";
      const token = crypto.randomBytes(24).toString("hex");
      const forwardedProto = (req.headers["x-forwarded-proto"] as string | undefined)?.split(",")[0]?.trim();
      const host = (req.headers["x-forwarded-host"] as string | undefined)?.split(",")[0]?.trim() || req.headers.host;
      const protocol = forwardedProto || (process.env.NODE_ENV === "production" ? "https" : "http");
      const appUrl = (process.env.APP_URL || `${protocol}://${host || "localhost:3000"}`).replace(/\/$/, "");

      // 1. Create invite in Firestore
      const inviteRef = db.collection("organizations").doc(orgId).collection("invites").doc();
      const inviteLink = `${appUrl}/accept-invite?orgId=${encodeURIComponent(orgId)}&inviteId=${encodeURIComponent(inviteRef.id)}&token=${encodeURIComponent(token)}`;
      const inviteData = {
        id: inviteRef.id,
        email: normalizedEmail,
        orgId,
        role: normalizedRole,
        invitedBy,
        status: 'pending',
        inviteToken: token,
        inviteLink,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      };
      await inviteRef.set(inviteData);

      // 2. Send email via Resend when configured
      const orgSnap = await db.collection("organizations").doc(orgId).get();
      const orgName = orgSnap.exists ? (orgSnap.data()?.name || "your organization") : "your organization";
      const fromEmail = process.env.INVITE_FROM_EMAIL || "Nexo Cloud <onboarding@resend.dev>";
      const resendApiKey = process.env.RESEND_API_KEY;
      const subject = `You're invited to join ${orgName} on Nexo Cloud`;
      const body = `You were invited to join ${orgName} as ${normalizedRole}.\n\nAccept invite: ${inviteLink}\n\nIf you don't recognize this invite, you can ignore this email.`;

      if (resendApiKey) {
        const resendResp = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: fromEmail,
            to: [normalizedEmail],
            subject,
            text: body,
          }),
        });

        if (!resendResp.ok) {
          const resendErrorText = await resendResp.text();
          console.error("Resend send failed", resendResp.status, resendErrorText);
          if (resendResp.status === 403) {
            return res.status(502).json({
              error: "Invite created, but Resend blocked delivery. Verify a sending domain in Resend and use that domain in INVITE_FROM_EMAIL.",
            });
          }
          return res.status(502).json({ error: "Invite created, but failed to send email. Check RESEND_API_KEY / INVITE_FROM_EMAIL." });
        }
      } else {
        // Fallback: persist intended email payload for visibility in dev environments.
        const emailRef = db.collection("sent_emails").doc();
        await emailRef.set({
          id: emailRef.id,
          to: normalizedEmail,
          subject,
          body,
          status: 'logged',
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      const responsePayload: Record<string, unknown> = { success: true, inviteId: inviteRef.id };
      if (!resendApiKey) {
        responsePayload.inviteLink = inviteLink;
      }
      res.json(responsePayload);
    } catch (error) {
      return sendApiError(res, error, "invite");
    }
  });

  app.post("/api/delete-account", async (req, res) => {
    try {
      const authHeader = req.headers.authorization || "";
      if (!authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const idToken = authHeader.slice("Bearer ".length).trim();
      const decoded = await admin.auth().verifyIdToken(idToken);
      const uid = decoded.uid;
      const email = String(decoded.email || "").trim().toLowerCase();

      const ownedOrgsSnap = await db.collection("organizations").where("ownerId", "==", uid).limit(1).get();
      if (!ownedOrgsSnap.empty) {
        return res.status(409).json({
          error: "You own an organization. Transfer ownership before deleting your account.",
        });
      }

      const memberDocs = await db.collectionGroup("members").where("uid", "==", uid).get();
      await deleteDocs(db, memberDocs.docs);

      const invitedByDocs = await db.collectionGroup("invites").where("invitedBy", "==", uid).get();
      await deleteDocs(db, invitedByDocs.docs);

      if (email) {
        const inviteDocsByEmail = await db.collectionGroup("invites").where("email", "==", email).get();
        const pendingInviteDocs = inviteDocsByEmail.docs.filter((docSnap) => docSnap.data().status === "pending");
        await deleteDocs(db, pendingInviteDocs);
      }

      await db.collection("users").doc(uid).delete().catch(() => undefined);
      await admin.auth().deleteUser(uid);

      return res.status(200).json({ success: true });
    } catch (error) {
      return sendApiError(res, error, "delete account");
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

  // Deep scan endpoint for advanced anomaly insights
  app.post("/api/deep-scan", async (req, res) => {
    const { serverId, lookbackHours = 24 } = req.body || {};
    if (!serverId) {
      return res.status(400).json({ error: "serverId is required" });
    }

    try {
      const serverRef = db.collection("servers").doc(serverId);
      const serverSnap = await serverRef.get();
      if (!serverSnap.exists) {
        return res.status(404).json({ error: "Server not found" });
      }

      const lookback = Number.isFinite(Number(lookbackHours)) ? Math.min(Math.max(Number(lookbackHours), 1), 168) : 24;
      const since = new Date(Date.now() - lookback * 60 * 60 * 1000);

      const metricsSnap = await serverRef
        .collection("metrics")
        .orderBy("timestamp", "desc")
        .limit(500)
        .get();

      const recentMetrics = metricsSnap.docs
        .map((doc) => doc.data())
        .filter((metric: any) => {
          const ts = new Date(metric.timestamp);
          return !Number.isNaN(ts.getTime()) && ts >= since;
        });

      if (recentMetrics.length === 0) {
        return res.json({
          success: true,
          scan: {
            serverId,
            lookbackHours: lookback,
            scannedPoints: 0,
            anomaliesDetected: 0,
            riskLevel: "none",
            findings: [],
            executedAt: new Date().toISOString(),
          },
        });
      }

      const findings: { type: string; severity: "warning" | "critical"; message: string }[] = [];
      let cpuSpikeCount = 0;
      let memSpikeCount = 0;
      let netSpikeCount = 0;

      for (const metric of recentMetrics) {
        if (metric.cpu >= 95) cpuSpikeCount += 1;
        if (metric.memory >= 92) memSpikeCount += 1;
        if (metric.network >= 900) netSpikeCount += 1;
      }

      if (cpuSpikeCount >= 3) {
        findings.push({
          type: "cpu_spike",
          severity: cpuSpikeCount >= 10 ? "critical" : "warning",
          message: `Detected ${cpuSpikeCount} high CPU spikes in last ${lookback}h`,
        });
      }
      if (memSpikeCount >= 3) {
        findings.push({
          type: "memory_pressure",
          severity: memSpikeCount >= 10 ? "critical" : "warning",
          message: `Detected ${memSpikeCount} memory pressure events in last ${lookback}h`,
        });
      }
      if (netSpikeCount >= 3) {
        findings.push({
          type: "network_surge",
          severity: netSpikeCount >= 10 ? "critical" : "warning",
          message: `Detected ${netSpikeCount} network surge events in last ${lookback}h`,
        });
      }

      const avgCpu = recentMetrics.reduce((sum: number, m: any) => sum + Number(m.cpu || 0), 0) / recentMetrics.length;
      const avgMem = recentMetrics.reduce((sum: number, m: any) => sum + Number(m.memory || 0), 0) / recentMetrics.length;
      const avgNet = recentMetrics.reduce((sum: number, m: any) => sum + Number(m.network || 0), 0) / recentMetrics.length;

      const riskScore = avgCpu * 0.45 + avgMem * 0.45 + Math.min(avgNet / 10, 100) * 0.1 + findings.length * 10;
      const riskLevel = riskScore >= 85 ? "critical" : riskScore >= 60 ? "elevated" : riskScore >= 35 ? "normal" : "none";

      const scanRef = serverRef.collection("deep_scans").doc();
      const scan = {
        id: scanRef.id,
        serverId,
        lookbackHours: lookback,
        scannedPoints: recentMetrics.length,
        anomaliesDetected: findings.length,
        riskLevel,
        findings,
        averages: {
          cpu: Number(avgCpu.toFixed(2)),
          memory: Number(avgMem.toFixed(2)),
          network: Number(avgNet.toFixed(2)),
        },
        executedAt: new Date().toISOString(),
      };
      await scanRef.set(scan);

      res.json({ success: true, scan });
    } catch (error) {
      return sendApiError(res, error, "deep scan");
    }
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
