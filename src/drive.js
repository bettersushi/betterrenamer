export const listFiles = async (accessToken, folderId = 'root', pageToken = null) => {
  const params = new URLSearchParams({
    q: `'${folderId}' in parents and trashed = false`,
    spaces: 'drive',
    fields: 'files(id,name,mimeType,size,createdTime),nextPageToken',
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
