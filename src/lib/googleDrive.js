import { google } from 'googleapis';
import fs from 'node:fs';
import path from 'node:path';

export async function getArticlesFromDrive() {
  try {
    let credentials;
    const keyPath = path.resolve(process.cwd(), 'gdrive-key.json');

    // 1. Local: Intenta leer el archivo
    if (fs.existsSync(keyPath)) {
      credentials = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
    } 
    // 2. Producción (Astro Build): Lee variables de entorno
    else {
      // Intentamos ambos métodos de lectura de variables
      const clientEmail = import.meta.env.GDRIVE_CLIENT_EMAIL || process.env.GDRIVE_CLIENT_EMAIL;
      let privateKey = import.meta.env.GDRIVE_PRIVATE_KEY || process.env.GDRIVE_PRIVATE_KEY;

      if (!clientEmail || !privateKey) {
        return [];
      }

      // LIMPIEZA ABSOLUTA DE LA LLAVE:
      // Removemos cabeceras, pies, comillas y TODO el espacio en blanco (incluyendo \n y \\n)
      // para quedarnos con el bloque base64 puro y reconstruirlo limpiamente.
      const body = privateKey
        .replace(/-----BEGIN PRIVATE KEY-----/, '')
        .replace(/-----END PRIVATE KEY-----/, '')
        .replace(/\\n/g, '')
        .replace(/\\+n/g, '')
        .replace(/\s+/g, '')
        .replace(/"/g, '')
        .trim();

      credentials = {
        client_email: clientEmail,
        private_key: `-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----`,
      };
    }

    const folderId = import.meta.env.GDRIVE_FOLDER_ID || process.env.GDRIVE_FOLDER_ID;

    if (!folderId) return [];

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });

    const drive = google.drive({ version: 'v3', auth });

    // 1. Carpetas
    const folderResponse = await drive.files.list({
      q: `'${folderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id, name)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    const folders = folderResponse.data.files || [];
    let allArticles = [];

    // 2. Archivos
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
    console.error('Error Drive:', error.message);
    return [];
  }
}
