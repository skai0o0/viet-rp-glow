import { supabase } from "@/integrations/supabase/client";

// ─── Crypto constants ───────────────────────────────────────
const PBKDF2_ITERATIONS = 100_000;
const SALT = "vietrp-byok-key-salt-v1"; // deterministic per-user
const ALGO_AES = { name: "AES-GCM", length: 256 } as const;
const ALGO_PBKDF2 = { name: "PBKDF2" } as const;

// ─── Key derivation ─────────────────────────────────────────

async function deriveEncryptionKey(userId: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(userId),
    ALGO_PBKDF2,
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      ...ALGO_PBKDF2,
      salt: enc.encode(SALT),
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    ALGO_AES,
    false,
    ["encrypt", "decrypt"],
  );
}

// ─── Encrypt / Decrypt ──────────────────────────────────────

export async function encryptApiKey(key: string, userId: string): Promise<string> {
  const cryptoKey = await deriveEncryptionKey(userId);
  const enc = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    enc.encode(key),
  );
  // Prepend IV to ciphertext: base64(iv + cipher)
  const combined = new Uint8Array(iv.length + new Uint8Array(cipher).length);
  combined.set(iv);
  combined.set(new Uint8Array(cipher), iv.length);
  return btoa(String.fromCharCode(...combined));
}

export async function decryptApiKey(encrypted: string, userId: string): Promise<string> {
  const cryptoKey = await deriveEncryptionKey(userId);
  const combined = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const cipher = combined.slice(12);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    cipher,
  );
  return new TextDecoder().decode(plain);
}

// ─── Supabase CRUD ──────────────────────────────────────────

interface UserApiKeysRow {
  openrouter_key: string | null;
  mimo_key: string | null;
  mimo_endpoint: string | null;
}

export interface ApiKeysToSave {
  openrouter_key?: string;
  mimo_key?: string;
  mimo_endpoint?: string;
}

export async function saveUserApiKeys(userId: string, keys: ApiKeysToSave): Promise<void> {
  const encrypted: Record<string, string | null> = {};

  if (keys.openrouter_key !== undefined) {
    encrypted.openrouter_key = keys.openrouter_key ? await encryptApiKey(keys.openrouter_key, userId) : null;
  }
  if (keys.mimo_key !== undefined) {
    encrypted.mimo_key = keys.mimo_key ? await encryptApiKey(keys.mimo_key, userId) : null;
  }
  if (keys.mimo_endpoint !== undefined) {
    encrypted.mimo_endpoint = keys.mimo_endpoint || null;
  }

  encrypted.updated_at = new Date().toISOString();

  const { error } = await supabase
    .from("user_api_keys")
    .upsert({ user_id: userId, ...encrypted }, { onConflict: "user_id" });

  if (error) {
    console.error("Failed to save user API keys:", error);
    throw error;
  }
}

export async function loadUserApiKeys(userId: string): Promise<{
  openrouter_key: string;
  mimo_key: string;
  mimo_endpoint: string;
}> {
  const { data, error } = await supabase
    .from("user_api_keys")
    .select("openrouter_key, mimo_key, mimo_endpoint")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) {
    return { openrouter_key: "", mimo_key: "", mimo_endpoint: "" };
  }

  const row = data as UserApiKeysRow;
  const results = { openrouter_key: "", mimo_key: "", mimo_endpoint: "" };

  try {
    if (row.openrouter_key) {
      results.openrouter_key = await decryptApiKey(row.openrouter_key, userId);
    }
  } catch (e) {
    console.warn("Failed to decrypt OpenRouter key:", e);
  }

  try {
    if (row.mimo_key) {
      results.mimo_key = await decryptApiKey(row.mimo_key, userId);
    }
  } catch (e) {
    console.warn("Failed to decrypt Mimo key:", e);
  }

  results.mimo_endpoint = row.mimo_endpoint || "";

  return results;
}

export async function clearUserApiKeys(userId: string): Promise<void> {
  const { error } = await supabase
    .from("user_api_keys")
    .delete()
    .eq("user_id", userId);

  if (error) {
    console.error("Failed to clear user API keys:", error);
    throw error;
  }
}
