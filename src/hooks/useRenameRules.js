import { useState, useCallback } from 'react'
import { useRenameQueue } from '../context/RenameQueueContext'
import { buildRenamePreviewForConfig } from '../renameQueueEngine'

const RULES_KEY = 'br_rename_rules'

// Regole "Better Rules" persistite in localStorage + apply-now che accoda job
// via RenameQueueContext. Estratto da DashboardPage per essere riusabile
// anche dal pulsante header "macro funzioni" in SearchPage.
export function useRenameRules(auth) {
  const { enqueueRaw } = useRenameQueue()
  const [rules, setRules] = useState(() => {
    try { return JSON.parse(localStorage.getItem(RULES_KEY) || '[]') } catch { return [] }
  })
  const [rulesApplying, setRulesApplying] = useState(false)
  const [rulesApplyMessage, setRulesApplyMessage] = useState('')

  const persistRules = (next) => {
    setRules(next)
    localStorage.setItem(RULES_KEY, JSON.stringify(next))
  }

  const handleApplyRulesNow = useCallback(async () => {
    if (rules.length === 0) return
    setRulesApplying(true)
    setRulesApplyMessage('')
    let queuedCount = 0
    let errorCount = 0
    try {
      for (const rule of rules) {
        try {
          const previewList = await buildRenamePreviewForConfig(
            auth.accessToken,
            { id: rule.folderId, name: rule.folderName },
            { ...rule.patternConfig, recursive: rule.recursive }
          )
          const toRename = previewList.filter(p => !p.skip)
          if (toRename.length === 0) continue
          enqueueRaw({
            rootFolderName: rule.folderName,
            rootFolderId: rule.folderId,
            mode: 'custom',
            preview: toRename,
            skipCount: previewList.length - toRename.length,
            status: 'pending',
            progress: { current: 0, total: toRename.length, currentFile: '', phase: '' },
          })
          queuedCount++
        } catch (e) {
          console.error(`Regola "${rule.name}" fallita:`, e)
          errorCount++
        }
      }
      setRulesApplyMessage(
        queuedCount === 0 && errorCount === 0
          ? 'Nessun file da rinominare — tutte le regole sono già rispettate.'
          : `${queuedCount} regola/e accodata/e${errorCount > 0 ? `, ${errorCount} fallita/e` : ''}.`
      )
    } finally {
      setRulesApplying(false)
    }
  }, [rules, auth.accessToken, enqueueRaw])

  return { rules, persistRules, rulesApplying, rulesApplyMessage, setRulesApplyMessage, handleApplyRulesNow }
}
