import { google } from 'googleapis';
import fs from 'node:fs';
import path from 'node:path';

export async function getArticlesFromDrive() {
  try {
    let credentials;
    const keyPath = path.resolve(process.cwd(), 'gdrive-key.json');

    // 1. Intentar cargar desde el archivo JSON (Local)
    if (fs.existsSync(keyPath)) {
      credentials = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
    } 
    // 2. Fallback: Reconstruir desde variables de entorno (Producción/CI)
    else {
      const clientEmail = process.env.GDRIVE_CLIENT_EMAIL || import.meta.env.GDRIVE_CLIENT_EMAIL;
      const privateKey = process.env.GDRIVE_PRIVATE_KEY || import.meta.env.GDRIVE_PRIVATE_KEY;

      if (!clientEmail || !privateKey) {
        console.warn('Credenciales de Google Drive no encontradas en archivo ni en variables de entorno');
        return [];
      }

      credentials = {
        client_email: clientEmail,
        // Limpiamos la llave por si viene con \n literales desde el panel de control del hosting
        private_key: privateKey.replace(/\\n/g, '\n').replace(/"/g, '').trim(),
      };
    }

    const folderId = process.env.GDRIVE_FOLDER_ID || import.meta.env.GDRIVE_FOLDER_ID;

    if (!folderId) {
      console.warn('GDRIVE_FOLDER_ID no definido');
      return [];
    }

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });

    const drive = google.drive({ version: 'v3', auth });

    // 1. Obtener subcarpetas (categorías)
    const folderResponse = await drive.files.list({
      q: `'${folderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id, name)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    const folders = folderResponse.data.files || [];
    let allArticles = [];

    // 2. Por cada carpeta, obtener los archivos
    for (const folder of folders) {
      const filesResponse = await drive.files.list({
        q: `'${folder.id}' in parents and trashed = false`,
        fields: 'files(id, name, description, webViewLink, createdTime)',
        orderBy: 'createdTime desc',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });

      const files = (filesResponse.data.files || []).map(file => ({
        title: file.name,
        category: folder.name,
        description: file.description || "Nota informativa cargada desde Google Drive.",
        link: file.webViewLink,
        date: new Date(file.createdTime).toLocaleDateString('es-ES', {
          day: '2-digit', month: 'short', year: 'numeric'
        })
      }));

      allArticles = [...allArticles, ...files];
    }

    return allArticles;
  } catch (error) {
    console.error('Drive Error:', error.message);
    return [];
  }
}
