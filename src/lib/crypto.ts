import { createCipheriv, createDecipheriv, randomBytes } from "crypto"

const ALGORITHM = "aes-256-gcm"

function getKey(): Buffer {
  const key = process.env.TOTP_ENCRYPTION_KEY
  if (!key || key.length !== 64) {
    throw new Error("TOTP_ENCRYPTION_KEY må være 64 hex-tegn (32 bytes)")
  }
  return Buffer.from(key, "hex")
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(16)
  const cipher = createCipheriv(ALGORITHM, getKey(), iv)

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()

  return Buffer.concat([iv, authTag, encrypted]).toString("base64url")
}

export function decrypt(encoded: string): string {
  const data = Buffer.from(encoded, "base64url")
  const iv = data.subarray(0, 16)
  const authTag = data.subarray(16, 32)
  const encrypted = data.subarray(32)

  const decipher = createDecipheriv(ALGORITHM, getKey(), iv)
  decipher.setAuthTag(authTag)

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
    "utf8"
  )
}
