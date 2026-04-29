/**
 * Google Drive API wrapper for appDataFolder operations.
 *
 * Uses the OAuth access token from the Auth.js session to call the
 * Drive REST API v3. All metadata files go in appDataFolder (narrow
 * scope). Binary files (audio, PDFs) use regular Drive storage with
 * the user's 15GB quota to avoid appDataFolder size limits.
 */

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";

export interface DriveFile {
  id: string;
  name: string;
  modifiedTime: string;
  size?: string;
}

/**
 * List all files in appDataFolder.
 */
export async function listAppDataFiles(
  accessToken: string
): Promise<DriveFile[]> {
  const res = await fetch(
    `${DRIVE_API}/files?spaces=appDataFolder&fields=files(id,name,modifiedTime,size)&pageSize=1000`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) throw new DriveError(res.status, await res.text());

  const data = await res.json();
  return data.files ?? [];
}

/**
 * Read a text file's content from appDataFolder.
 */
export async function readFileContent(
  accessToken: string,
  fileId: string
): Promise<string> {
  const res = await fetch(
    `${DRIVE_API}/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) throw new DriveError(res.status, await res.text());

  return res.text();
}

/**
 * Create a new text file in appDataFolder.
 */
export async function createAppDataFile(
  accessToken: string,
  name: string,
  content: string
): Promise<DriveFile> {
  const metadata = {
    name,
    parents: ["appDataFolder"],
    mimeType: "application/json",
  };

  const form = new FormData();
  form.append(
    "metadata",
    new Blob([JSON.stringify(metadata)], { type: "application/json" })
  );
  form.append("file", new Blob([content], { type: "application/json" }));

  const res = await fetch(
    `${UPLOAD_API}/files?uploadType=multipart&fields=id,name,modifiedTime`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    }
  );

  if (!res.ok) throw new DriveError(res.status, await res.text());

  return res.json();
}

/**
 * Update an existing file's content. Uses If-Match with ETag for safe writes.
 */
export async function updateFileContent(
  accessToken: string,
  fileId: string,
  content: string,
  etag?: string
): Promise<DriveFile> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
  if (etag) headers["If-Match"] = etag;

  const res = await fetch(
    `${UPLOAD_API}/files/${fileId}?uploadType=media&fields=id,name,modifiedTime`,
    {
      method: "PATCH",
      headers,
      body: content,
    }
  );

  if (!res.ok) throw new DriveError(res.status, await res.text());

  return res.json();
}

/**
 * Delete a file from Drive.
 */
export async function deleteFile(
  accessToken: string,
  fileId: string
): Promise<void> {
  const res = await fetch(`${DRIVE_API}/files/${fileId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok && res.status !== 404) {
    throw new DriveError(res.status, await res.text());
  }
}

/**
 * Get storage quota information.
 */
export async function getStorageQuota(
  accessToken: string
): Promise<{ usage: number; limit: number }> {
  const res = await fetch(
    `${DRIVE_API}/about?fields=storageQuota`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) throw new DriveError(res.status, await res.text());

  const data = await res.json();
  return {
    usage: parseInt(data.storageQuota?.usage ?? "0"),
    limit: parseInt(data.storageQuota?.limit ?? "0"),
  };
}

export class DriveError extends Error {
  constructor(
    public status: number,
    public body: string
  ) {
    super(`Drive API error ${status}: ${body.slice(0, 200)}`);
    this.name = "DriveError";
  }

  get isAuthError() {
    return this.status === 401 || this.status === 403;
  }

  get isRateLimit() {
    return this.status === 429;
  }

  get isNotFound() {
    return this.status === 404;
  }
}
