import { google } from 'googleapis';

/**
 * Versión optimizada que recibe el JSON completo de credenciales y el Folder ID.
 */
export async function getArticlesFromDrive(credentialsJSON, folderId) {
  try {
    if (!credentialsJSON || !folderId) {
      console.warn('Faltan credenciales o Folder ID');
      return [];
    }

    // Parseamos el JSON para obtener el objeto de credenciales puro
    let credentials;
    try {
      credentials = typeof credentialsJSON === 'string' 
        ? JSON.parse(credentialsJSON) 
        : credentialsJSON;
    } catch (e) {
      throw new Error("El formato del GDRIVE_JSON es inválido. Asegúrate de pegar el contenido completo del archivo JSON.");
    }

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });

    const drive = google.drive({ version: 'v3', auth });

    // 1. Categorías
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
    throw new Error(`Google Drive Error: ${error.message}`);
  }
}
