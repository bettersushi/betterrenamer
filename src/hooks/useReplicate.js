import { useState, useCallback } from 'react'

export function useReplicate() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const enhance = useCallback(async (fileId, accessToken, scale) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId, accessToken, scale }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Elaborazione fallita')
      return data.resultUrl
    } catch (e) {
      setError(e.message)
      throw e
    } finally {
      setLoading(false)
    }
  }, [])

  return { loading, error, enhance }
}
