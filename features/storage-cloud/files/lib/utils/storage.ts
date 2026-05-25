import env from "@configs/env";
import { createClient } from "@supabase/supabase-js";
import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import { Jimp } from "jimp";
import multer, { FileFilterCallback } from "multer";
import path from "path";
import type { Request } from "express";
import { rootPath } from "./path";

const RESIZE_MAX_WIDTH = 1024;
const JPEG_QUALITY = 80;

async function resizeToJpegBuffer(
  input: Buffer,
  maxWidth = RESIZE_MAX_WIDTH,
  quality = JPEG_QUALITY,
): Promise<Buffer> {
  const image = await Jimp.read(input);
  if (image.width > maxWidth) {
    await image.resize({ w: maxWidth });
  }
  return Buffer.from(
    await image.getBuffer("image/jpeg", { quality: Math.round(quality) }),
  );
}

async function resizeToJpegFile(
  input: Buffer,
  filePath: string,
  maxWidth = RESIZE_MAX_WIDTH,
  quality = JPEG_QUALITY,
): Promise<void> {
  const image = await Jimp.read(input);
  if (image.width > maxWidth) {
    await image.resize({ w: maxWidth });
  }
  await image.write(filePath as `${string}.jpg`);
}

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
] as const;

export const MAX_FILE_SIZE = 10 * 1024 * 1024;

export const fileUploader = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 5 },
  fileFilter(
    _req: Request,
    file: Express.Multer.File,
    cb: FileFilterCallback,
  ) {
    if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.mimetype)) {
      return cb(
        new Error(
          `Invalid file type. Allowed: ${ALLOWED_IMAGE_TYPES.join(", ")}`,
        ),
      );
    }
    cb(null, true);
  },
});

export interface StorageAdapter {
  upload(file: Express.Multer.File): Promise<string | null>;
}

export class DiskStorageAdapter implements StorageAdapter {
  async upload(file: Express.Multer.File): Promise<string | null> {
    const uploadDir = rootPath("public", "uploads");
    fs.mkdirSync(uploadDir, { recursive: true });

    const base = path.basename(
      file.originalname,
      path.extname(file.originalname),
    );
    const fileName = `${Date.now()}_${base.replace(/[^a-zA-Z0-9_-]/g, "_")}.jpg`;
    const filePath = path.join(uploadDir, fileName);

    await resizeToJpegFile(file.buffer, filePath);
    return `/uploads/${fileName}`;
  }
}

export class CloudinaryStorageAdapter implements StorageAdapter {
  constructor() {
    cloudinary.config({
      cloud_name: env.cloudinaryCloudName,
      api_key: env.cloudinaryApiKey,
      api_secret: env.cloudinaryApiSecret,
    });
  }

  async upload(file: Express.Multer.File): Promise<string | null> {
    const resizedImage = await resizeToJpegBuffer(file.buffer);

    return new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          { folder: "uploads", resource_type: "image", format: "jpg" },
          (error, result) => {
            if (error || !result) {
              return reject(new Error("Cloudinary upload failed"));
            }
            resolve(result.secure_url);
          },
        )
        .end(resizedImage);
    });
  }
}

export class SupabaseStorageAdapter implements StorageAdapter {
  private supabase = createClient(env.supabaseUrl, env.supabaseKey);

  async upload(
    file: Express.Multer.File,
    bucket = "uploads",
  ): Promise<string | null> {
    const resizedImage = await resizeToJpegBuffer(file.buffer);
    const base = path.basename(
      file.originalname,
      path.extname(file.originalname),
    );
    const fileName = `${Date.now()}_${base.replace(/[^a-zA-Z0-9_-]/g, "_")}.jpg`;
    const objectPath = `public/${fileName}`;

    const { error } = await this.supabase.storage
      .from(bucket)
      .upload(objectPath, resizedImage, {
        contentType: "image/jpeg",
        upsert: true,
      });

    if (error) throw new Error(`Supabase upload failed: ${error.message}`);
    return (
      this.supabase.storage.from(bucket).getPublicUrl(objectPath).data
        .publicUrl || null
    );
  }
}

let storageAdapterInstance: StorageAdapter | null = null;

export function getStorageAdapter(): StorageAdapter {
  if (!storageAdapterInstance) {
    if (env.storageService === "supabase") {
      storageAdapterInstance = new SupabaseStorageAdapter();
    } else if (env.storageService === "cloudinary") {
      storageAdapterInstance = new CloudinaryStorageAdapter();
    } else {
      storageAdapterInstance = new DiskStorageAdapter();
    }
  }
  return storageAdapterInstance;
}
