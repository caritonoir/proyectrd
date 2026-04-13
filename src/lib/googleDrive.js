import { google } from 'googleapis';
import fs from 'node:fs';
import path from 'node:path';

export async function getArticlesFromDrive() {
  try {
    // Usar el archivo JSON directamente para evitar problemas de formato en el .env
    const keyPath = path.resolve(process.cwd(), 'gdrive-key.json');
    const folderId = process.env.GDRIVE_FOLDER_ID || import.meta.env.GDRIVE_FOLDER_ID;

    if (!fs.existsSync(keyPath)) {
      console.warn('Archivo gdrive-key.json no encontrado');
      return [];
    }

    const credentials = JSON.parse(fs.readFileSync(keyPath, 'utf8'));

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
    if (error.code === 403) {
      console.error('Error 403: Permiso denegado. Asegúrate de que la API de Google Drive esté HABILITADA en la consola de Google Cloud.');
    } else {
      console.error('Drive Error:', error.message);
    }
    return [];
  }
}
