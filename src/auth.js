// ============================================================================
// src/auth.js — merchant signup / login / session handling.
// ============================================================================
import { json, readJson, bearer, genId, genApiKey, genSessionToken, hashPassword, verifyPassword, SESSION_TTL_DAYS } from "./utils.js";
import { getSettings } from "./settings.js";

export async function getMerchantByApiKey(request, env) {
  const key = bearer(request);
  if (!key) return null;
  return await env.DB.prepare(`SELECT * FROM merchants WHERE api_key = ?`).bind(key).first();
}

export async function getMerchantBySession(request, env) {
  const token = bearer(request);
  if (!token) return null;
  const session = await env.DB.prepare(`SELECT * FROM sessions WHERE token = ?`).bind(token).first();
  if (!session || Date.now() > session.expires_at) return null;
  return await env.DB.prepare(`SELECT * FROM merchants WHERE id = ?`).bind(session.merchant_id).first();
}

export function merchantPublic(m) {
  return {
    id: m.id, fullName: m.full_name, email: m.email, mobile: m.mobile, telegram: m.telegram,
    apiKey: m.api_key, balance: m.balance, status: m.status, createdAt: m.created_at,
  };
}

export async function signup(request, env) {
  const settings = await getSettings(env);
  if (!settings.SIGNUP_ENABLED) return json({ error: "নতুন সাইনআপ সাময়িকভাবে বন্ধ আছে।" }, 403);

  const body = await readJson(request);
  const fullName = String(body.fullName || "").trim().slice(0, 120);
  const email = String(body.email || "").trim().toLowerCase().slice(0, 180);
  const mobile = String(body.mobile || "").trim().slice(0, 20);
  const telegram = body.telegram ? String(body.telegram).trim().slice(0, 60) : null;
  const password = String(body.password || "");

  if (!fullName || !email || !mobile) return json({ error: "নাম, ইমেইল এবং মোবাইল নম্বর আবশ্যক।" }, 400);
  if (!/^\S+@\S+\.\S+$/.test(email)) return json({ error: "সঠিক একটি ইমেইল ঠিকানা দিন।" }, 400);
  if (password.length < 8) return json({ error: "পাসওয়ার্ড কমপক্ষে ৮ ক্যারেক্টারের হতে হবে।" }, 400);

  const existing = await env.DB.prepare(`SELECT id FROM merchants WHERE email = ?`).bind(email).first();
  if (existing) return json({ error: "এই ইমেইল দিয়ে ইতিমধ্যে একটি অ্যাকাউন্ট আছে।" }, 409);

  const { hash, salt } = await hashPassword(password);
  const id = genId("M", 12);
  const apiKey = genApiKey();
  const now = Date.now();

  await env.DB.prepare(
    `INSERT INTO merchants (id, full_name, email, mobile, telegram, password_hash, password_salt, api_key, balance, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'active', ?)`
  ).bind(id, fullName, email, mobile, telegram, hash, salt, apiKey, now).run();

  const token = genSessionToken();
  const expiresAt = now + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;
  await env.DB.prepare(`INSERT INTO sessions (token, merchant_id, created_at, expires_at) VALUES (?, ?, ?, ?)`).bind(token, id, now, expiresAt).run();

  return json({ token, merchant: merchantPublic({ id, full_name: fullName, email, mobile, telegram, api_key: apiKey, balance: 0, status: "active", created_at: now }) }, 201);
}

export async function login(request, env) {
  const body = await readJson(request);
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  if (!email || !password) return json({ error: "ইমেইল এবং পাসওয়ার্ড আবশ্যক।" }, 400);

  const merchant = await env.DB.prepare(`SELECT * FROM merchants WHERE email = ?`).bind(email).first();
  if (!merchant) return json({ error: "ইমেইল অথবা পাসওয়ার্ড সঠিক নয়।" }, 401);
  if (merchant.status !== "active") return json({ error: "এই অ্যাকাউন্টটি সাসপেন্ড করা হয়েছে।" }, 403);

  const ok = await verifyPassword(password, merchant.password_salt, merchant.password_hash);
  if (!ok) return json({ error: "ইমেইল অথবা পাসওয়ার্ড সঠিক নয়।" }, 401);

  const token = genSessionToken();
  const now = Date.now();
  const expiresAt = now + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;
  await env.DB.prepare(`INSERT INTO sessions (token, merchant_id, created_at, expires_at) VALUES (?, ?, ?, ?)`).bind(token, merchant.id, now, expiresAt).run();

  return json({ token, merchant: merchantPublic(merchant) }, 200);
}

export async function logout(request, env) {
  const token = bearer(request);
  if (token) await env.DB.prepare(`DELETE FROM sessions WHERE token = ?`).bind(token).run();
  return json({ ok: true }, 200);
}

export async function me(request, env) {
  const merchant = await getMerchantBySession(request, env);
  if (!merchant) return json({ error: "অননুমোদিত।" }, 401);
  return json(merchantPublic(merchant), 200);
}

export async function getKeys(request, env) {
  const merchant = await getMerchantBySession(request, env);
  if (!merchant) return json({ error: "অননুমোদিত।" }, 401);
  return json({ apiKey: merchant.api_key }, 200);
}
export async function regenerateKey(request, env) {
  const merchant = await getMerchantBySession(request, env);
  if (!merchant) return json({ error: "অননুমোদিত।" }, 401);
  const newKey = genApiKey();
  await env.DB.prepare(`UPDATE merchants SET api_key=? WHERE id=?`).bind(newKey, merchant.id).run();
  return json({ apiKey: newKey }, 200);
}
