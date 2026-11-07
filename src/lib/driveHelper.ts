/**
 * Utility helpers to handle Google Drive video & folder links, generate
 * embedded preview player URLs, thumbnail URLs, auto-detect titles,
 * and bulk extract files from Google Drive folders.
 */

export function extractDriveFileId(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();

  // If it's already an ID (alphanumeric, dashes, underscores, length typically 20-50)
  if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) {
    return trimmed;
  }

  // Pattern 1: /file/d/FILE_ID/...
  const fileDMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileDMatch && fileDMatch[1]) {
    return fileDMatch[1];
  }

  // Pattern 2: id=FILE_ID
  const idQueryMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idQueryMatch && idQueryMatch[1]) {
    return idQueryMatch[1];
  }

  // Pattern 3: /d/FILE_ID
  const dMatch = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (dMatch && dMatch[1]) {
    return dMatch[1];
  }

  return null;
}

export function extractDriveFolderId(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();

  // Pattern 1: /folders/FOLDER_ID
  const folderMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch && folderMatch[1]) {
    return folderMatch[1];
  }

  // Pattern 2: id=FOLDER_ID
  const idMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch && idMatch[1]) {
    return idMatch[1];
  }

  // Pattern 3: If bare ID (20+ chars)
  if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

export function getDrivePreviewUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/preview`;
}

export function getDriveThumbnailUrl(fileId: string): string {
  // Google Drive thumbnail API endpoint
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`;
}

export function getDriveDirectUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/view`;
}

/**
 * Automatically fetches the video/file title from Google Drive via backend proxy
 */
export async function fetchDriveTitle(
  urlOrId: string
): Promise<{ title: string; rawTitle?: string } | null> {
  const fileId = extractDriveFileId(urlOrId);
  if (!fileId) return null;

  try {
    const res = await fetch(`/api/drive-title?fileId=${encodeURIComponent(fileId)}`);
    if (!res.ok) {
      return null;
    }
    const data = await res.json();
    if (data && data.title) {
      return {
        title: data.title,
        rawTitle: data.rawTitle,
      };
    }
    return null;
  } catch (err) {
    console.warn('Failed to auto-fetch Drive video title:', err);
    return null;
  }
}

export interface DriveFolderFile {
  id: string;
  title: string;
  rawName: string;
  driveUrl: string;
  previewUrl: string;
  isVideo: boolean;
}

export interface DriveFolderResult {
  folderId: string;
  folderTitle: string;
  totalFiles: number;
  files: DriveFolderFile[];
}

/**
 * Fetches all video/file items contained in a public Google Drive folder
 */
export async function fetchDriveFolderFiles(
  urlOrId: string
): Promise<DriveFolderResult | null> {
  const folderId = extractDriveFolderId(urlOrId);
  if (!folderId) return null;

  try {
    const res = await fetch(`/api/drive-folder?folderId=${encodeURIComponent(folderId)}`);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP ${res.status}`);
    }
    const data = await res.json();
    return data as DriveFolderResult;
  } catch (err) {
    console.warn('Failed to fetch Drive folder contents:', err);
    throw err;
  }
}
