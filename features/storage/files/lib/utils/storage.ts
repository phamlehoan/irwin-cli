import env from "@configs/env";
import fs from "fs";
import { Jimp } from "jimp";
import multer, { FileFilterCallback } from "multer";
import path from "path";
import type { Request } from "express";
import { rootPath } from "./path";

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
] as const;

export const MAX_FILE_SIZE = 10 * 1024 * 1024;

async function resizeToJpegFile(
  input: Buffer,
  filePath: string,
  maxWidth = 1024,
  quality = 80,
): Promise<void> {
  const image = await Jimp.read(input);
  if (image.width > maxWidth) {
    await image.resize({ w: maxWidth });
  }
  await image.write(filePath as `${string}.jpg`);
}

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

    const base = path.basename(file.originalname, path.extname(file.originalname));
    const fileName = `${Date.now()}_${base.replace(/[^a-zA-Z0-9_-]/g, "_")}.jpg`;
    const filePath = path.join(uploadDir, fileName);

    await resizeToJpegFile(file.buffer, filePath);
    return `/uploads/${fileName}`;
  }
}

let storageAdapter: StorageAdapter | null = null;

export function getStorageAdapter(): StorageAdapter {
  if (!storageAdapter) {
    if (env.storageService !== "local") {
      throw new Error(
        `[storage] Only "local" is included in this pack. STORAGE_SERVICE=${env.storageService}`,
      );
    }
    storageAdapter = new DiskStorageAdapter();
  }
  return storageAdapter;
}
