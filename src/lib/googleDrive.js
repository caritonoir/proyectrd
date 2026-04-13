import { google } from 'googleapis';

/**
 * Función que recibe las credenciales directamente para evitar problemas de contexto
 * en entornos de construcción como Netlify/Vercel.
 */
export async function getArticlesFromDrive(clientEmail, privateKey, folderId) {
  try {
    if (!clientEmail || !privateKey || !folderId) {
      console.warn('Faltan credenciales para Google Drive');
      return [];
    }

    // Limpieza de la llave para asegurar formato PEM
    const body = privateKey
      .replace(/-----BEGIN PRIVATE KEY-----/, '')
      .replace(/-----END PRIVATE KEY-----/, '')
      .replace(/\\n/g, '')
      .replace(/\\+n/g, '')
      .replace(/\s+/g, '')
      .replace(/"/g, '')
      .trim();

    const cleanKey = `-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----`;

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

    // 2. Obtener archivos por categoría
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
    console.error('Error en getArticlesFromDrive:', error.message);
    return [];
  }
}
