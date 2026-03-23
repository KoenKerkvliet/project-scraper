import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Site, SiteInsert } from '../types/database'

export function useSites() {
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)

  const fetchSites = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('sites')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && data) setSites(data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchSites() }, [fetchSites])

  const addSite = async (site: Pick<SiteInsert, 'name' | 'url' | 'selector'>) => {
    const { error } = await supabase.from('sites').insert(site)
    if (!error) await fetchSites()
    return { error }
  }

  const updateSite = async (id: string, updates: Partial<SiteInsert>) => {
    const { error } = await supabase.from('sites').update(updates).eq('id', id)
    if (!error) await fetchSites()
    return { error }
  }

  const deleteSite = async (id: string) => {
    const { error } = await supabase.from('sites').delete().eq('id', id)
    if (!error) await fetchSites()
    return { error }
  }

  const toggleSite = async (id: string, isActive: boolean) => {
    return updateSite(id, { is_active: isActive })
  }

  return { sites, loading, fetchSites, addSite, updateSite, deleteSite, toggleSite }
}
