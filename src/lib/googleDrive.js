import { google } from 'googleapis';

export async function getArticlesFromDrive(clientEmail, privateKey, folderId) {
  let cleanKey = "";
  try {
    if (!clientEmail || !privateKey || !folderId) {
      return [];
    }

    // 1. Limpieza inicial: quitamos comillas si existen
    cleanKey = privateKey.trim();
    if (cleanKey.startsWith('"') && cleanKey.endsWith('"')) {
        cleanKey = cleanKey.substring(1, cleanKey.length - 1);
    }

    // 2. Resolver escapes de \n si vienen literales de Netlify
    cleanKey = cleanKey.replace(/\\n/g, '\n').replace(/\\+n/g, '\n');

    // 3. Asegurar encabezados correctos
    if (!cleanKey.includes('-----BEGIN PRIVATE KEY-----')) {
        cleanKey = `-----BEGIN PRIVATE KEY-----\n${cleanKey}\n-----END PRIVATE KEY-----`;
    }

    // Limpieza final de espacios y retornos de carro
    cleanKey = cleanKey.replace(/\r/g, '').trim();

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: clientEmail,
        private_key: cleanKey,
      },
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });

    const drive = google.drive({ version: 'v3', auth });

    // Cargamos los artículos
    const folderResponse = await drive.files.list({
      q: `'${folderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id, name)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    const folders = folderResponse.data.files || [];
    let allArticles = [];

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
    // DIAGNÓSTICO CRÍTICO: Mostramos metadatos de la llave (sin exponerla toda)
    const head = cleanKey ? cleanKey.substring(0, 10).replace(/\n/g, '[n]') : "null";
    const tail = cleanKey ? cleanKey.substring(cleanKey.length - 10).replace(/\n/g, '[n]') : "null";
    const len = cleanKey ? cleanKey.length : 0;
    
    throw new Error(`Google Drive API Error (Head: ${head}, Tail: ${tail}, Len: ${len}): ${error.message}`);
  }
}
