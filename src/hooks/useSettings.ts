import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Settings } from '../types/database'

export function useSettings() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchSettings = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('settings')
      .select('*')
      .single()

    setSettings(data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchSettings() }, [fetchSettings])

  const saveSettings = async (updates: { emailit_api_key: string | null; notification_email: string | null }) => {
    if (settings) {
      const { error } = await supabase
        .from('settings')
        .update(updates)
        .eq('id', settings.id)
      if (!error) await fetchSettings()
      return { error }
    } else {
      const { error } = await supabase
        .from('settings')
        .insert(updates)
      if (!error) await fetchSettings()
      return { error }
    }
  }

  return { settings, loading, saveSettings }
}
