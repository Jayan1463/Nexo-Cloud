import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "gen-lang-client-0298517899";
const FIREBASE_DATABASE_ID =
  process.env.FIREBASE_DATABASE_ID || "ai-studio-a6e8cce4-ae5a-499a-9a1c-ced13c60c908";

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

if (!admin.apps.length) {
  const serviceAccount = parseServiceAccount();
  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: FIREBASE_PROJECT_ID,
    });
  } else {
    admin.initializeApp({
      projectId: FIREBASE_PROJECT_ID,
    });
  }
}

function getDb() {
  const app = admin.app();
  if (FIREBASE_DATABASE_ID) {
    return getFirestore(app, FIREBASE_DATABASE_ID);
  }
  return getFirestore(app);
}

async function deleteDocs(docs: FirebaseFirestore.QueryDocumentSnapshot[]) {
  if (docs.length === 0) return;
  const db = getDb();
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

export default async function handler(req: any, res: any) {
  if (req.method === "OPTIONS") {
    res.setHeader("Allow", "POST, OPTIONS");
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON && !process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    return res.status(503).json({
      error: "Firebase Admin credentials missing. Set FIREBASE_SERVICE_ACCOUNT_JSON in Vercel env.",
    });
  }

  try {
    const authHeader = req.headers.authorization || "";
    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const idToken = authHeader.slice("Bearer ".length).trim();
    const decoded = await admin.auth().verifyIdToken(idToken);
    const uid = decoded.uid;
    const email = String(decoded.email || "").trim().toLowerCase();
    const db = getDb();

    const ownedOrgsSnap = await db.collection("organizations").where("ownerId", "==", uid).limit(1).get();
    if (!ownedOrgsSnap.empty) {
      return res.status(409).json({
        error: "You own an organization. Transfer ownership before deleting your account.",
      });
    }

    const memberDocs = await db.collectionGroup("members").where("uid", "==", uid).get();
    await deleteDocs(memberDocs.docs);

    const invitedByDocs = await db.collectionGroup("invites").where("invitedBy", "==", uid).get();
    await deleteDocs(invitedByDocs.docs);

    if (email) {
      const inviteDocsByEmail = await db.collectionGroup("invites").where("email", "==", email).get();
      const pendingInviteDocs = inviteDocsByEmail.docs.filter((docSnap) => docSnap.data().status === "pending");
      await deleteDocs(pendingInviteDocs);
    }

    await db.collection("users").doc(uid).delete().catch(() => undefined);
    await admin.auth().deleteUser(uid);

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error deleting account:", error);
    return res.status(500).json({ error: "Failed to delete account." });
  }
}
