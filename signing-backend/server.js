const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const B2 = require("backblaze-b2");

dotenv.config();

const {
  B2_KEY_ID,
  B2_APP_KEY,
  B2_BUCKET_NAME,
  B2_BUCKET_ID,
  ALLOWED_PREFIX = "",
  SIGNED_URL_TTL = "3600",
  PORT = "8080",
} = process.env;

if (!B2_KEY_ID || !B2_APP_KEY || !B2_BUCKET_NAME) {
  console.error("Missing required env vars: B2_KEY_ID, B2_APP_KEY, B2_BUCKET_NAME");
  process.exit(1);
}

const b2 = new B2({
  applicationKeyId: B2_KEY_ID,
  applicationKey: B2_APP_KEY,
});

let bucketId = null;
let downloadUrl = null;

const ensureAuthorized = async () => {
  if (b2.authorizationToken) return;
  await b2.authorize();
  downloadUrl = b2.downloadUrl;
};

const ensureBucket = async () => {
  if (bucketId) return;
  if (B2_BUCKET_ID) {
    bucketId = B2_BUCKET_ID;
    return;
  }
  await ensureAuthorized();
  const res = await b2.listBuckets({ accountId: b2.accountId });
  const bucket = res.data.buckets.find((b) => b.bucketName === B2_BUCKET_NAME);
  if (!bucket) {
    throw new Error(`Bucket not found: ${B2_BUCKET_NAME}`);
  }
  bucketId = bucket.bucketId;
};

const isAllowed = (fileName) => {
  if (!ALLOWED_PREFIX) return true;
  return fileName.startsWith(ALLOWED_PREFIX);
};

const app = express();
app.use(cors());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/sign", async (req, res) => {
  try {
    const file = req.query.file;
    if (!file || typeof file !== "string") {
      return res.status(400).json({ error: "Missing file query param" });
    }
    if (!isAllowed(file)) {
      return res.status(403).json({ error: "File not allowed" });
    }
    await ensureBucket();
    const ttl = Math.min(Math.max(parseInt(SIGNED_URL_TTL, 10) || 3600, 60), 86400);
    const authRes = await b2.getDownloadAuthorization({
      bucketId,
      fileNamePrefix: file,
      validDurationInSeconds: ttl,
    });
    const token = authRes.data.authorizationToken;
    const url = `${downloadUrl}/file/${B2_BUCKET_NAME}/${encodeURI(file)}?Authorization=${encodeURIComponent(token)}`;
    res.json({ url, expiresIn: ttl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to sign URL" });
  }
});

app.get("/list", async (req, res) => {
  try {
    const prefix = typeof req.query.prefix === "string" ? req.query.prefix : "";
    if (!isAllowed(prefix)) {
      return res.status(403).json({ error: "Prefix not allowed" });
    }
    await ensureBucket();
    let nextFileName = null;
    const files = [];
    do {
      const resp = await b2.listFileNames({
        bucketId,
        startFileName: nextFileName || undefined,
        maxFileCount: 1000,
        prefix: prefix || undefined,
      });
      files.push(...resp.data.files.map((f) => f.fileName));
      nextFileName = resp.data.nextFileName || null;
    } while (nextFileName);
    res.json({ files });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to list files" });
  }
});

app.listen(parseInt(PORT, 10), () => {
  console.log(`Signed URL server running on port ${PORT}`);
});
