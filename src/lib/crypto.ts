// AES-256-GCM field-level encryption for sensitive data (bank account details).
// Ciphertext layout: base64(iv[12] || authTag[16] || encrypted).
import crypto from 'crypto'

const ALGO = 'aes-256-gcm'

function getKey(): Buffer {
  const keyHex = process.env.BANK_ENCRYPTION_KEY
  if (!keyHex || keyHex.length !== 64) {
    throw new Error('BANK_ENCRYPTION_KEY must be set to a 64-character hex string (32 bytes)')
  }
  return Buffer.from(keyHex, 'hex')
}

export function encryptField(value: string | null | undefined): string | null {
  if (!value) return null
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return Buffer.concat([iv, authTag, encrypted]).toString('base64')
}

export function decryptField(value: string | null | undefined): string | null {
  if (!value) return null
  try {
    const buf = Buffer.from(value, 'base64')
    const iv = buf.subarray(0, 12)
    const authTag = buf.subarray(12, 28)
    const encrypted = buf.subarray(28)
    const decipher = crypto.createDecipheriv(ALGO, getKey(), iv)
    decipher.setAuthTag(authTag)
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
    return decrypted.toString('utf8')
  } catch (e) {
    console.error('decryptField failed — value may predate encryption or key changed', e)
    return null
  }
}
