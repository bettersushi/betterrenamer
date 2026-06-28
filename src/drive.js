export const listFiles = async (accessToken, folderId = 'root', pageToken = null) => {
  const params = new URLSearchParams({
    q: `'${folderId}' in parents and trashed = false`,
    spaces: 'drive',
    fields: 'files(id,name,mimeType,size,createdTime,modifiedTime),nextPageToken',
    pageSize: 1000,
    orderBy: 'folder,name',
    pageToken: pageToken || '',
  });

  const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) throw new Error('Failed to list files');
  return response.json();
};

const traverseFolder = async (accessToken, folderId, folderName, isRoot, includeRoot, results) => {
  const data = await listFiles(accessToken, folderId)
  const allItems = data.files || []
  const subfolders = allItems.filter(f => f.mimeType === 'application/vnd.google-apps.folder')
  const files = allItems.filter(f => f.mimeType !== 'application/vnd.google-apps.folder')

  if (!isRoot || includeRoot) {
    const sorted = [...files].sort((a, b) => new Date(a.modifiedTime) - new Date(b.modifiedTime))
    if (sorted.length > 0) results.push({ folderName, folderId, files: sorted })
  }

  for (const subfolder of subfolders) {
    await traverseFolder(accessToken, subfolder.id, subfolder.name, false, includeRoot, results)
  }
}

export const listFilesRecursive = async (accessToken, rootFolderId, rootFolderName, includeRoot) => {
  const results = []
  await traverseFolder(accessToken, rootFolderId, rootFolderName, true, includeRoot, results)
  return results
}

export const renameFile = async (accessToken, fileId, newName) => {
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: newName }),
    }
  );

  if (!response.ok) throw new Error('Failed to rename file');
  return response.json();
};

export const batchRenameFiles = async (accessToken, files) => {
  const results = [];

  for (const file of files) {
    try {
      const result = await renameFile(accessToken, file.id, file.newName);
      results.push({
        success: true,
        oldName: file.oldName,
        newName: result.name,
        message: 'Rinominato correttamente',
      });
    } catch (error) {
      results.push({
        success: false,
        oldName: file.oldName,
        newName: file.newName,
        message: error.message,
      });
    }
  }

  return results;
};
