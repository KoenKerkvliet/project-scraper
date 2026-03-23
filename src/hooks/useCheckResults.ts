import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { CheckResult } from '../types/database'

export function useCheckResults(siteId: string) {
  const [results, setResults] = useState<CheckResult[]>([])
  const [loading, setLoading] = useState(true)

  const fetchResults = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('check_results')
      .select('*')
      .eq('site_id', siteId)
      .order('checked_at', { ascending: false })
      .limit(50)

    if (!error && data) setResults(data)
    setLoading(false)
  }, [siteId])

  return { results, loading, fetchResults }
}
