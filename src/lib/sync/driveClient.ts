/**
 * Google Drive API wrapper.
 *
 * Uses a dedicated "QualCoding" folder in the user's Drive (visible
 * to them, uses their 15GB quota). Uses the drive.file scope which
 * only requires basic verification.
 */

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";
const APP_FOLDER_NAME = "QualCoding";

export interface DriveFile {
  id: string;
  name: string;
  modifiedTime: string;
  size?: string;
}

let appFolderId: string | null = null;

/**
 * Get or create the QualCoding folder in the user's Drive root.
 */
async function getOrCreateAppFolder(accessToken: string): Promise<string> {
  if (appFolderId) return appFolderId;

  // Search for existing folder
  const searchRes = await fetch(
    `${DRIVE_API}/files?q=name='${APP_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id)&pageSize=1`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!searchRes.ok) throw new DriveError(searchRes.status, await searchRes.text());

  const searchData = await searchRes.json();
  if (searchData.files?.length > 0) {
    appFolderId = searchData.files[0].id;
    return appFolderId!;
  }

  // Create folder
  const createRes = await fetch(`${DRIVE_API}/files`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: APP_FOLDER_NAME,
      mimeType: "application/vnd.google-apps.folder",
    }),
  });

  if (!createRes.ok) throw new DriveError(createRes.status, await createRes.text());

  const folder = await createRes.json();
  appFolderId = folder.id;
  return appFolderId!;
}

/**
 * List all files in the QualCoding folder.
 */
export async function listAppDataFiles(
  accessToken: string
): Promise<DriveFile[]> {
  const folderId = await getOrCreateAppFolder(accessToken);

  const res = await fetch(
    `${DRIVE_API}/files?q='${folderId}' in parents and trashed=false&fields=files(id,name,modifiedTime,size)&pageSize=1000`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) throw new DriveError(res.status, await res.text());

  const data = await res.json();
  return data.files ?? [];
}

/**
 * Read a text file's content.
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
 * Create a new text file in the QualCoding folder.
 */
export async function createAppDataFile(
  accessToken: string,
  name: string,
  content: string
): Promise<DriveFile> {
  const folderId = await getOrCreateAppFolder(accessToken);

  const metadata = {
    name,
    parents: [folderId],
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
 * Update an existing file's content.
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
