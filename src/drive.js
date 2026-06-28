export const listFiles = async (accessToken, folderId = 'root') => {
  const allFiles = []
  let pageToken = null

  do {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed = false`,
      spaces: 'drive',
      fields: 'files(id,name,mimeType,size,createdTime,modifiedTime),nextPageToken',
      pageSize: 1000,
      orderBy: 'folder,name',
    })
    if (pageToken) params.set('pageToken', pageToken)

    const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!response.ok) throw new Error('Failed to list files')
    const data = await response.json()
    allFiles.push(...(data.files || []))
    pageToken = data.nextPageToken || null
  } while (pageToken)

  return { files: allFiles }
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

export const createFolder = async (accessToken, name, parentId) => {
  const response = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    }),
  })
  if (!response.ok) throw new Error('Failed to create folder')
  return response.json()
}

export const findFolder = async (accessToken, name, parentId) => {
  const params = new URLSearchParams({
    q: `'${parentId}' in parents and name = '${name.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id,name)',
    pageSize: 1,
  })
  const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) throw new Error('Failed to search folder')
  const data = await response.json()
  return data.files?.[0] || null
}

export const getOrCreateFolder = async (accessToken, name, parentId) => {
  const existing = await findFolder(accessToken, name, parentId)
  if (existing) return existing
  return createFolder(accessToken, name, parentId)
}

export const moveFile = async (accessToken, fileId, newParentId, oldParentId) => {
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?addParents=${newParentId}&removeParents=${oldParentId}&fields=id,name`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    }
  )
  if (!response.ok) throw new Error('Failed to move file')
  return response.json()
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
