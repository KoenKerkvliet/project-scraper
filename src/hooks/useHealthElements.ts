import { useState, useCallback } from 'react'
import type { HealthElement } from '../types/database'

export function useHealthElements(siteUrl: string) {
  const [elements, setElements] = useState<HealthElement[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const fetchElements = useCallback(async () => {
    if (loading) return
    setLoading(true)

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
      const response = await fetch(`${supabaseUrl}/functions/v1/health-proxy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ site_url: siteUrl }),
      })

      if (response.ok) {
        const data = await response.json()
        setElements(data.elements || [])
      }
    } catch {
      // Health proxy not available
    }

    setLoading(false)
    setLoaded(true)
  }, [siteUrl, loading])

  return { elements, loading, loaded, fetchElements }
}
