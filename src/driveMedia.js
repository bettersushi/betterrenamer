export function directDriveMediaUrl(fileId, accessToken) {
  return `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&access_token=${encodeURIComponent(accessToken)}`
}
