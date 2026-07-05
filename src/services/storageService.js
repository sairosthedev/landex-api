import fs from 'fs/promises';
import path from 'path';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import config from '../config/index.js';
import { sha256 } from '../utils/crypto.js';

let s3Client = null;

function getS3Client() {
  if (!s3Client) {
    s3Client = new S3Client({
      region: config.objectStorage.region,
      endpoint: config.objectStorage.provider === 'local' ? undefined : config.objectStorage.endpoint,
      credentials: {
        accessKeyId: config.objectStorage.accessKey,
        secretAccessKey: config.objectStorage.secretKey,
      },
      forcePathStyle: true,
    });
  }
  return s3Client;
}

export class LocalFileStorageService {
  constructor(basePath = config.storage.basePath) {
    this.basePath = basePath;
  }

  async ensureDir(dir) {
    await fs.mkdir(dir, { recursive: true });
  }

  async store(relativePath, buffer) {
    const fullPath = path.join(this.basePath, relativePath);
    await this.ensureDir(path.dirname(fullPath));
    await fs.writeFile(fullPath, buffer);
    return relativePath;
  }

  async read(relativePath) {
    return fs.readFile(path.join(this.basePath, relativePath));
  }

  async delete(relativePath) {
    try {
      await fs.unlink(path.join(this.basePath, relativePath));
    } catch {
      /* ignore missing */
    }
  }
}

export class ObjectStorageService {
  constructor() {
    this.bucket = config.objectStorage.bucket;
    this.provider = config.objectStorage.provider;
    this.local = new LocalFileStorageService(path.join(config.storage.basePath, 'objects'));
  }

  async upload(key, buffer, contentType) {
    const checksum = sha256(buffer);
    if (this.provider === 'local') {
      await this.local.store(key, buffer);
    } else {
      const client = getS3Client();
      await client.send(new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }));
    }
    return { storageKey: key, checksum };
  }

  async download(key) {
    if (this.provider === 'local') {
      return this.local.read(key);
    }
    const client = getS3Client();
    const response = await client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    const chunks = [];
    for await (const chunk of response.Body) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  async getPresignedUrl(key) {
    if (this.provider === 'local') {
      return `/api/v1/documents/local/${encodeURIComponent(key)}`;
    }
    const client = getS3Client();
    return getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: config.objectStorage.presignedUrlExpirationMinutes * 60 },
    );
  }

  async delete(key) {
    if (this.provider === 'local') {
      return this.local.delete(key);
    }
    const client = getS3Client();
    await client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}

export const localFileStorage = new LocalFileStorageService();
export const objectStorage = new ObjectStorageService();
