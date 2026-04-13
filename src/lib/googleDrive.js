import { google } from 'googleapis';

export async function getArticlesFromDrive(clientEmail, privateKey, folderId) {
  try {
    if (!clientEmail || !privateKey || !folderId) {
      return [];
    }

    // LIMPIEZA QUIRÚRGICA PARA NETLIFY:
    // 1. Quitamos comillas extremas si existen
    let cleanKey = privateKey.trim().replace(/^"(.*)"$/, '$1');

    // 2. Si la llave parece estar escapada como un string de JSON (muy común en Netlify),
    // la parseamos para que JS resuelva los \n automáticamente.
    if (cleanKey.includes('\\n')) {
      try {
        // Intentamos parsear como JSON para resolver escapes
        cleanKey = JSON.parse(`"${cleanKey}"`);
      } catch (e) {
        // Fallback si el parse falla
        cleanKey = cleanKey.replace(/\\n/g, '\n');
      }
    }

    // 3. Limpieza final de espacios y retornos de carro
    cleanKey = cleanKey.replace(/\r/g, '').trim();

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: clientEmail,
        private_key: cleanKey,
      },
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });

    const drive = google.drive({ version: 'v3', auth });

    // 1. Obtener categorías
    const folderResponse = await drive.files.list({
      q: `'${folderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id, name)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    const folders = folderResponse.data.files || [];
    let allArticles = [];

    // 2. Obtener archivos
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
    // Lanzamos el error original para que sea visible en el build de Astro/Netlify
    throw new Error(`Google Drive API Error: ${error.message}`);
  }
}
