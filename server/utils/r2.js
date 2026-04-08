import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
});

export function isR2Configured() {
  return !!(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_BUCKET);
}

/**
 * อัปโหลด buffer ไป R2 แล้วคืน public URL
 * @param {Buffer} buffer
 * @param {string} mimeType
 * @returns {Promise<string>} public URL
 */
export async function uploadToR2(buffer, mimeType = 'image/jpeg', folder = 'line') {
  const ext = mimeType.split('/')[1]?.replace('jpeg', 'jpg').replace('mpeg', 'mp3') || 'bin';
  const key = `${folder}/${randomUUID()}.${ext}`;

  await r2.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: mimeType,
    CacheControl: 'public, max-age=31536000',
  }));

  return `${process.env.R2_PUBLIC_URL}/${key}`;
}
