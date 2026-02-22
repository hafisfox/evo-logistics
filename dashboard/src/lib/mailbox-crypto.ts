import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ENCRYPTION_VERSION = "v1";
const AES_GCM_ALGORITHM = "aes-256-gcm";
const IV_BYTE_LENGTH = 12;

function toBase64Url(value: Buffer) {
  return value
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, "base64");
}

function tryDecodeKeyCandidate(value: string): Buffer | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, "hex");
  }

  try {
    return fromBase64Url(trimmed);
  } catch {
    return null;
  }
}

function getMailboxTokenEncryptionKey(): Buffer {
  const raw = process.env.MAILBOX_TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("MAILBOX_TOKEN_ENCRYPTION_KEY is not configured");
  }

  const decoded = tryDecodeKeyCandidate(raw);
  const key = decoded && decoded.length > 0 ? decoded : Buffer.from(raw, "utf8");
  if (key.length !== 32) {
    throw new Error(
      "MAILBOX_TOKEN_ENCRYPTION_KEY must decode to 32 bytes (base64url/base64/hex/raw)"
    );
  }
  return key;
}

export function encryptMailboxToken(token: string, workspaceId: string): string {
  if (!token || !workspaceId) {
    throw new Error("encryptMailboxToken requires token and workspaceId");
  }

  const key = getMailboxTokenEncryptionKey();
  const iv = randomBytes(IV_BYTE_LENGTH);
  const cipher = createCipheriv(AES_GCM_ALGORITHM, key, iv);
  cipher.setAAD(Buffer.from(workspaceId, "utf8"));

  const encrypted = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    ENCRYPTION_VERSION,
    toBase64Url(iv),
    toBase64Url(encrypted),
    toBase64Url(authTag),
  ].join(".");
}

export function decryptMailboxToken(payload: string, workspaceId: string): string {
  if (!payload || !workspaceId) {
    throw new Error("decryptMailboxToken requires payload and workspaceId");
  }

  const [version, ivPart, encryptedPart, tagPart] = payload.split(".");
  if (
    version !== ENCRYPTION_VERSION ||
    !ivPart ||
    !encryptedPart ||
    !tagPart
  ) {
    throw new Error("Invalid mailbox token payload format");
  }

  const key = getMailboxTokenEncryptionKey();
  const iv = fromBase64Url(ivPart);
  const encrypted = fromBase64Url(encryptedPart);
  const authTag = fromBase64Url(tagPart);

  const decipher = createDecipheriv(AES_GCM_ALGORITHM, key, iv);
  decipher.setAAD(Buffer.from(workspaceId, "utf8"));
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}
