import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
export function storage() {
  for (const key of [
    "S3_ENDPOINT",
    "S3_BUCKET",
    "S3_ACCESS_KEY_ID",
    "S3_SECRET_ACCESS_KEY",
  ])
    if (!process.env[key]) throw new Error("Image storage is not configured");
  return new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION || "auto",
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
  });
}
export function objectUrl(key: string) {
  storage();
  const url = new URL(process.env.S3_ENDPOINT!);
  url.pathname = `${url.pathname.replace(/\/$/, "")}/${encodeURIComponent(process.env.S3_BUCKET!)}/${key.split("/").map(encodeURIComponent).join("/")}`;
  return url.toString();
}
export function keyFromObjectUrl(value: string) {
  const prefix = objectUrl("");
  if (!value.startsWith(prefix) || value === prefix)
    throw new Error("Image URL does not belong to configured storage");
  return value
    .slice(prefix.length)
    .split("/")
    .map(decodeURIComponent)
    .join("/");
}
export async function upload(key: string, body: Buffer, type: string) {
  await storage().send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: type,
    }),
  );
  return objectUrl(key);
}
export async function verifyObject(key: string) {
  return storage().send(
    new HeadObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }),
  );
}
export async function signedImageUrl(url: string) {
  return getSignedUrl(
    storage(),
    new GetObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: keyFromObjectUrl(url),
    }),
    { expiresIn: 300 },
  );
}
