const LOGS_KEY = 'betterrenamer_logs'
const MAX_SESSIONS = 50

export const saveSession = (session) => {
  const sessions = getSessions()
  sessions.unshift(session)
  localStorage.setItem(LOGS_KEY, JSON.stringify(sessions.slice(0, MAX_SESSIONS)))
}

export const getSessions = () => {
  try {
    return JSON.parse(localStorage.getItem(LOGS_KEY)) || []
  } catch {
    return []
  }
}

export const clearSessions = () => {
  localStorage.removeItem(LOGS_KEY)
}

export const exportSessionCSV = (session) => {
  const lines = ['"Nome Originale","Nome Nuovo","Cartella","Status"']
  for (const entry of session.entries) {
    const status = entry.success ? 'OK' : `ERRORE: ${entry.error || ''}`
    lines.push(`"${entry.oldName}","${entry.newName}","${entry.folderName}","${status}"`)
  }
  return lines.join('\n')
}

export const downloadCSV = (session) => {
  const csv = exportSessionCSV(session)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `betterrenamer-${new Date(session.date).toISOString().slice(0, 10)}-${session.rootFolder}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
