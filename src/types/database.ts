export interface Site {
  id: string
  user_id: string
  name: string
  url: string
  selector: string
  is_active: boolean
  last_status: 'ok' | 'error' | 'pending'
  last_checked_at: string | null
  created_at: string
}

export interface SiteInsert {
  id?: string
  user_id?: string
  name: string
  url: string
  selector: string
  is_active?: boolean
  last_status?: 'ok' | 'error' | 'pending'
  last_checked_at?: string | null
  created_at?: string
}

export interface CheckResult {
  id: string
  site_id: string
  status: 'ok' | 'error'
  response_time_ms: number | null
  error_message: string | null
  checked_at: string
}

export interface Settings {
  id: string
  user_id: string
  emailit_api_key: string | null
  notification_email: string | null
}
