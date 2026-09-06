// ============================================================================
// src/utils.js
// Generic, stateless helpers shared by every route module.
// ============================================================================

// ----------------------------------------------------------------------------
// CORS
// ----------------------------------------------------------------------------

export function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

// ----------------------------------------------------------------------------
// JSON Response
// ----------------------------------------------------------------------------

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...corsHeaders(),
      ...extraHeaders,
    },
  });
}

// ----------------------------------------------------------------------------
// Read JSON body safely
// ----------------------------------------------------------------------------

export async function readJson(request) {
  try {
    const body = await request.json();

    if (!body || typeof body !== "object") {
      return {};
    }

    return body;
  } catch {
    return {};
  }
}

// ----------------------------------------------------------------------------
// Transaction ID normalization
// ----------------------------------------------------------------------------

export function normalizeTrx(trx) {
  return String(trx || "")
    .trim()
    .toUpperCase();
}

// ----------------------------------------------------------------------------
// Payment methods
// ----------------------------------------------------------------------------

export const METHODS = [
  "bkash",
  "nagad",
  "rocket",
  "upay",
];

export function normalizeMethod(method) {
  const m = String(method || "")
    .trim()
    .toLowerCase();

  return METHODS.includes(m) ? m : null;
}

// ----------------------------------------------------------------------------
// Authorization / Bearer token
// ----------------------------------------------------------------------------

export function bearer(request) {
  if (!request) return null;

  const auth = request.headers.get("Authorization") || "";

  if (!auth) return null;

  // Expected:
  // Authorization: Bearer YOUR_ADMIN_KEY

  const match = auth.match(/^Bearer\s+(.+)$/i);

  if (!match) return null;

  const token = match[1].trim();

  return token || null;
}

// ----------------------------------------------------------------------------
// Admin authentication
// ----------------------------------------------------------------------------

export function requireAdmin(request, env) {
  const providedKey = bearer(request);

  // ADMIN_KEY must exist in Cloudflare Worker environment.
  const configuredKey =
    env && env.ADMIN_KEY
      ? String(env.ADMIN_KEY).trim()
      : "";

  if (!providedKey) {
    return false;
  }

  if (!configuredKey) {
    return false;
  }

  return providedKey === configuredKey;
}

// ----------------------------------------------------------------------------
// Random ID helpers
// ----------------------------------------------------------------------------

export function genId(prefix, len = 8) {
  const cleanPrefix = String(prefix || "");

  const randomPart = crypto
    .randomUUID()
    .replace(/-/g, "")
    .slice(0, len)
    .toUpperCase();

  return cleanPrefix + randomPart;
}

// ----------------------------------------------------------------------------
// Merchant API key
// ----------------------------------------------------------------------------

export function genApiKey() {
  return (
    "pk_" +
    crypto.randomUUID().replace(/-/g, "") +
    crypto.randomUUID().replace(/-/g, "").slice(0, 8)
  );
}

// ----------------------------------------------------------------------------
// Session token
// ----------------------------------------------------------------------------

export function genSessionToken() {
  return (
    crypto.randomUUID().replace(/-/g, "") +
    crypto.randomUUID().replace(/-/g, "")
  );
}

// ----------------------------------------------------------------------------
// Hex helpers
// ----------------------------------------------------------------------------

function bytesToHex(bytes) {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBytes(hex) {
  const clean = String(hex || "").trim();

  if (!clean || clean.length % 2 !== 0) {
    throw new Error("Invalid hex string");
  }

  const arr = new Uint8Array(clean.length / 2);

  for (let i = 0; i < arr.length; i++) {
    arr[i] = parseInt(clean.substr(i * 2, 2), 16);
  }

  return arr;
}

// ----------------------------------------------------------------------------
// Password hashing
// ----------------------------------------------------------------------------

export async function hashPassword(password, saltHex) {
  const enc = new TextEncoder();

  const salt = saltHex
    ? hexToBytes(saltHex)
    : crypto.getRandomValues(new Uint8Array(16));

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(String(password || "")),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );

  return {
    hash: bytesToHex(new Uint8Array(bits)),
    salt: bytesToHex(salt),
  };
}

// ----------------------------------------------------------------------------
// Password verification
// ----------------------------------------------------------------------------

export async function verifyPassword(password, saltHex, hashHex) {
  try {
    const result = await hashPassword(password, saltHex);

    return result.hash === String(hashHex || "").trim().toLowerCase();
  } catch {
    return false;
  }
}

// ----------------------------------------------------------------------------
// HMAC SHA-256 signature
// ----------------------------------------------------------------------------

export async function signPayload(payload, key) {
  const encoder = new TextEncoder();

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(String(key || "")),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    encoder.encode(String(payload || ""))
  );

  return bytesToHex(new Uint8Array(signature));
}

// ----------------------------------------------------------------------------
// Platform constants
// ----------------------------------------------------------------------------

export const SESSION_TTL_DAYS = 30;

export const AMOUNT_TOLERANCE = 0.5;
