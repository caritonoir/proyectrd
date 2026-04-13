import { google } from 'googleapis';
import fs from 'node:fs';
import path from 'node:path';

export async function getArticlesFromDrive() {
  try {
    let credentials;
    // En Netlify SSR, process.cwd() apunta a la raíz del proyecto
    const keyPath = path.resolve(process.cwd(), 'gdrive-key.json');

    // 1. Prioridad: Archivo JSON (Local o si se subió por error)
    if (fs.existsSync(keyPath)) {
      credentials = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
    } 
    // 2. Producción: Variables de Entorno (Modo SSR)
    else {
      // En modo SSR de Netlify, usamos process.env para mayor compatibilidad
      const clientEmail = process.env.GDRIVE_CLIENT_EMAIL;
      const privateKey = process.env.GDRIVE_PRIVATE_KEY;

      if (!clientEmail || !privateKey) {
        return [];
      }

      credentials = {
        client_email: clientEmail,
        // Regex ultra-robusta para limpiar la llave de Netlify
        private_key: privateKey.replace(/\\+n/g, '\n').replace(/"/g, '').trim(),
      };
    }

    const folderId = process.env.GDRIVE_FOLDER_ID;

    if (!folderId) {
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
    // Log silencioso pero útil para depuración en el panel de Netlify si hiciera falta
    console.error('Data Fetch Error:', error.message);
    return [];
  }
}
