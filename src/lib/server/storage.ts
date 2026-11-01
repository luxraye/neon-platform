import "server-only";

import { getDownloadURL } from "firebase-admin/storage";
import { adminBucket } from "@/lib/firebase/admin";

/**
 * Uploads a file to Cloud Storage for Firebase and returns a long-lived download URL.
 * Paths are always built on the server from the caller's centre id, never from user input.
 */
export async function uploadFile(
  path: string,
  data: ArrayBuffer | Buffer,
  contentType: string,
  opts?: { overwrite?: boolean }
): Promise<{ url: string | null; error: { message: string } | null }> {
  try {
    const file = adminBucket().file(path);
    if (!opts?.overwrite) {
      const [exists] = await file.exists();
      if (exists) return { url: null, error: { message: "A file with this name already exists." } };
    }
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
    await file.save(buffer, { contentType, resumable: false, metadata: { cacheControl: "public, max-age=3600" } });
    const url = await getDownloadURL(file);
    return { url, error: null };
  } catch (e) {
    return { url: null, error: { message: (e as Error).message ?? "Upload failed." } };
  }
}
