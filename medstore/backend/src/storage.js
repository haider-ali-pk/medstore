// backend/src/storage.js
// Picture uploads to Supabase Storage. Needs no extra npm package.
//  - uploadImage()   -> PUBLIC bucket  (product pictures, logos)   returns a public URL
//  - uploadPrivate() -> PRIVATE bucket (customer prescriptions)    returns the object path; view it with signedUrl()
const crypto = require("crypto");

const ALLOWED = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const fail = (msg, status = 400) => Object.assign(new Error(msg), { status });

function configured() {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function parseDataUrl(dataUrl) {
  if (!configured())
    throw fail("Image upload is not set up yet (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY). You can still paste an image URL.");
  const m = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(dataUrl || "");
  if (!m || !ALLOWED[m[1].toLowerCase()]) throw fail("Use a JPG, PNG or WebP image.");
  const buf = Buffer.from(m[2], "base64");
  if (buf.length > 3 * 1024 * 1024) throw fail("Image is too large (max 3 MB).");
  return { type: m[1], ext: ALLOWED[m[1].toLowerCase()], buf };
}

async function put(bucket, path, { type, buf }, cache) {
  const base = process.env.SUPABASE_URL.replace(/\/$/, "");
  const res = await fetch(`${base}/storage/v1/object/${bucket}/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      "Content-Type": type,
      "Cache-Control": cache,
    },
    body: buf,
  });
  if (!res.ok) {
    console.error("Supabase upload failed:", res.status, await res.text().catch(() => ""));
    throw fail("Upload failed. Check the Supabase bucket name (and that product-images is public).", 502);
  }
  return base;
}

const fileName = (ext) => `${Date.now()}-${crypto.randomBytes(8).toString("hex")}.${ext}`;

/** dataUrl = "data:image/webp;base64,...." -> returns public URL */
async function uploadImage(dataUrl, folder = "products") {
  const img = parseDataUrl(dataUrl);
  const bucket = process.env.SUPABASE_BUCKET || "product-images";
  const path = `${folder}/${fileName(img.ext)}`;
  const base = await put(bucket, path, img, "31536000");
  return `${base}/storage/v1/object/public/${bucket}/${path}`;
}

/** Prescriptions are health data: they go to a PRIVATE bucket and are only ever shown through a short-lived signed link. */
const privateBucket = () => process.env.SUPABASE_PRIVATE_BUCKET || "prescriptions";

async function uploadPrivate(dataUrl, folder) {
  const img = parseDataUrl(dataUrl);
  const path = `${folder}/${fileName(img.ext)}`;
  await put(privateBucket(), path, img, "60");
  return path;
}

async function signedUrl(path, seconds = 600) {
  if (!configured()) throw fail("Storage is not configured.", 400);
  const base = process.env.SUPABASE_URL.replace(/\/$/, "");
  const res = await fetch(`${base}/storage/v1/object/sign/${privateBucket()}/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ expiresIn: seconds }),
  });
  if (!res.ok) throw fail("Could not open the prescription file.", 502);
  const { signedURL } = await res.json();
  return `${base}/storage/v1${signedURL}`;
}

module.exports = { uploadImage, uploadPrivate, signedUrl, configured };