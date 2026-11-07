import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json());

  // API endpoint to automatically extract file title from Google Drive
  app.get('/api/drive-title', async (req, res) => {
    try {
      const fileIdParam = req.query.fileId as string;
      if (!fileIdParam || typeof fileIdParam !== 'string') {
        return res.status(400).json({ error: 'fileId query parameter is required' });
      }

      // Extract raw ID if full URL was provided
      let targetId = fileIdParam.trim();
      const fileDMatch = targetId.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      const idParamMatch = targetId.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      const dMatch = targetId.match(/\/d\/([a-zA-Z0-9_-]+)/);

      if (fileDMatch && fileDMatch[1]) {
        targetId = fileDMatch[1];
      } else if (idParamMatch && idParamMatch[1]) {
        targetId = idParamMatch[1];
      } else if (dMatch && dMatch[1]) {
        targetId = dMatch[1];
      }

      // Fetch Drive page with standard browser headers
      const previewUrl = `https://drive.google.com/file/d/${targetId}/view`;
      const response = await fetch(previewUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });

      if (!response.ok) {
        return res.status(response.status).json({
          error: `Google Drive returned HTTP ${response.status}`,
        });
      }

      const html = await response.text();
      const ogTitleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i);
      const titleTagMatch = html.match(/<title>([^<]+)<\/title>/i);

      let rawTitle = ogTitleMatch ? ogTitleMatch[1] : titleTagMatch ? titleTagMatch[1] : null;

      if (!rawTitle || rawTitle.includes('Page not found') || rawTitle.includes('Google Drive - Access Denied')) {
        return res.status(404).json({ error: 'Could not retrieve video title. Ensure file is shared as anyone with link can view.' });
      }

      // Strip " - Google Drive" trailer
      rawTitle = rawTitle.replace(/\s*-\s*Google Drive$/i, '').trim();

      // Clean common video extensions
      let cleanTitle = rawTitle.replace(/\.(mp4|mov|mkv|avi|webm|m4v|flv|wmv|ts)$/i, '').trim();

      // Decode HTML entities
      cleanTitle = cleanTitle
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");

      return res.json({
        fileId: targetId,
        rawTitle,
        title: cleanTitle,
      });
    } catch (err: unknown) {
      console.error('Error in /api/drive-title:', err);
      const message = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ error: message });
    }
  });

  // API endpoint to fetch all files and titles inside a public Google Drive folder
  app.get('/api/drive-folder', async (req, res) => {
    try {
      const folderIdParam = req.query.folderId as string;
      if (!folderIdParam || typeof folderIdParam !== 'string') {
        return res.status(400).json({ error: 'folderId query parameter is required' });
      }

      let targetFolderId = folderIdParam.trim();
      const folderMatch = targetFolderId.match(/\/folders\/([a-zA-Z0-9_-]+)/);
      const idMatch = targetFolderId.match(/[?&]id=([a-zA-Z0-9_-]+)/);

      if (folderMatch && folderMatch[1]) {
        targetFolderId = folderMatch[1];
      } else if (idMatch && idMatch[1]) {
        targetFolderId = idMatch[1];
      }

      const folderUrl = `https://drive.google.com/embeddedfolderview?id=${encodeURIComponent(targetFolderId)}`;
      const response = await fetch(folderUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });

      if (!response.ok) {
        return res.status(response.status).json({
          error: `Google Drive returned status ${response.status}. Please make sure the folder sharing permission is set to "Anyone with the link can view".`,
        });
      }

      const html = await response.text();
      const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
      const folderTitle = titleMatch ? titleMatch[1].replace(/\s*-\s*Google Drive$/i, '').trim() : 'Google Drive Folder';

      // Parse all file anchor tags
      const fileRegex = /href=[\"'](?:https:\/\/drive\.google\.com)?\/file\/d\/([a-zA-Z0-9_-]{20,})\/view[^\"]*[\"'][^>]*>([\s\S]*?)<\/a>/gi;
      const seenIds = new Set<string>();
      const files: Array<{
        id: string;
        title: string;
        rawName: string;
        driveUrl: string;
        previewUrl: string;
        isVideo: boolean;
      }> = [];

      for (const match of html.matchAll(fileRegex)) {
        const fileId = match[1];
        if (seenIds.has(fileId)) continue;
        seenIds.add(fileId);

        let rawName = match[2].replace(/<[^>]+>/g, '').trim();
        // Decode HTML entities
        rawName = rawName
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'");

        const isVideo = /\.(mp4|mov|mkv|webm|avi|m4v|flv|wmv|ts)$/i.test(rawName);
        let cleanTitle = rawName.replace(/\.(mp4|mov|mkv|avi|webm|m4v|flv|wmv|ts|pdf|docx?|pptx?|xlsx?)$/i, '').trim();

        files.push({
          id: fileId,
          title: cleanTitle || rawName,
          rawName,
          driveUrl: `https://drive.google.com/file/d/${fileId}/view`,
          previewUrl: `https://drive.google.com/file/d/${fileId}/preview`,
          isVideo,
        });
      }

      if (files.length === 0) {
        return res.status(404).json({
          error: 'No files found in this folder. Please verify the link points to a shared folder containing files with "Anyone with the link can view" permission.',
          folderTitle,
        });
      }

      return res.json({
        success: true,
        folderId: targetFolderId,
        folderTitle,
        totalFiles: files.length,
        files,
      });
    } catch (err: unknown) {
      console.error('Error in /api/drive-folder:', err);
      const message = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ error: message });
    }
  });

  // Mount Vite middleware in dev or static files in production
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

startServer();
