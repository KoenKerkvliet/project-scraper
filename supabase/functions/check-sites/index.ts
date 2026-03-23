// Supabase Edge Function: check-sites
// Checkt alle actieve sites op aanwezigheid van het opgegeven CSS selector element.
// Stuurt EmailIt notificatie als element ontbreekt.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Site {
  id: string
  user_id: string
  name: string
  url: string
  selector: string
  is_active: boolean
  last_status: string
}

interface Settings {
  emailit_api_key: string | null
  notification_email: string | null
}

// Convert CSS selector to a regex pattern that matches in raw HTML
function selectorToHtmlPattern(selector: string): RegExp | null {
  // Handle #id selectors
  const idMatch = selector.match(/^#([\w-]+)$/)
  if (idMatch) {
    return new RegExp(`id=["']${idMatch[1]}["']`, 'i')
  }

  // Handle .class selectors
  const classMatch = selector.match(/^\.([\w-]+)$/)
  if (classMatch) {
    return new RegExp(`class=["'][^"']*\\b${classMatch[1]}\\b[^"']*["']`, 'i')
  }

  // Handle tag#id
  const tagIdMatch = selector.match(/^(\w+)#([\w-]+)$/)
  if (tagIdMatch) {
    return new RegExp(`<${tagIdMatch[1]}[^>]*id=["']${tagIdMatch[2]}["']`, 'i')
  }

  // Handle tag.class
  const tagClassMatch = selector.match(/^(\w+)\.([\w-]+)$/)
  if (tagClassMatch) {
    return new RegExp(`<${tagClassMatch[1]}[^>]*class=["'][^"']*\\b${tagClassMatch[2]}\\b`, 'i')
  }

  // Handle [attribute=value]
  const attrMatch = selector.match(/^\[([\w-]+)=["']?([^"'\]]+)["']?\]$/)
  if (attrMatch) {
    return new RegExp(`${attrMatch[1]}=["']${attrMatch[2]}["']`, 'i')
  }

  // Handle data-* attribute presence
  const dataAttrMatch = selector.match(/^\[([\w-]+)\]$/)
  if (dataAttrMatch) {
    return new RegExp(`${dataAttrMatch[1]}(?:=["'][^"']*["']|[\\s>])`, 'i')
  }

  // Fallback: plain tag name
  const tagMatch = selector.match(/^(\w+)$/)
  if (tagMatch) {
    return new RegExp(`<${tagMatch[1]}[\\s>]`, 'i')
  }

  return null
}

async function sendEmailNotification(
  apiKey: string,
  toEmail: string,
  siteName: string,
  siteUrl: string,
  selector: string,
  errorMessage: string
) {
  const response = await fetch('https://api.emailit.com/v1/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: 'Site Monitor <noreply@emailit.com>',
      to: toEmail,
      subject: `⚠️ Element ontbreekt op ${siteName}`,
      html: `
        <h2>Site Monitor Alert</h2>
        <p>Het gemonitorde element is <strong>niet gevonden</strong> op de volgende site:</p>
        <table style="border-collapse: collapse; margin: 16px 0;">
          <tr>
            <td style="padding: 8px; font-weight: bold;">Site:</td>
            <td style="padding: 8px;">${siteName}</td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold;">URL:</td>
            <td style="padding: 8px;"><a href="${siteUrl}">${siteUrl}</a></td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold;">Selector:</td>
            <td style="padding: 8px;"><code>${selector}</code></td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold;">Fout:</td>
            <td style="padding: 8px;">${errorMessage}</td>
          </tr>
        </table>
        <p>Controleer of de Bricks Builder code opnieuw gesigned moet worden.</p>
      `,
    }),
  })

  return response.ok
}

async function checkSite(site: Site): Promise<{ status: 'ok' | 'error'; responseTimeMs: number; errorMessage: string | null }> {
  const startTime = Date.now()

  try {
    const response = await fetch(site.url, {
      headers: {
        'User-Agent': 'SiteMonitor/1.0',
      },
      redirect: 'follow',
    })

    const responseTimeMs = Date.now() - startTime

    if (!response.ok) {
      return {
        status: 'error',
        responseTimeMs,
        errorMessage: `HTTP ${response.status}: ${response.statusText}`,
      }
    }

    const html = await response.text()
    const pattern = selectorToHtmlPattern(site.selector)

    if (!pattern) {
      return {
        status: 'error',
        responseTimeMs,
        errorMessage: `Ongeldig selector formaat: ${site.selector}`,
      }
    }

    const found = pattern.test(html)

    return {
      status: found ? 'ok' : 'error',
      responseTimeMs,
      errorMessage: found ? null : `Element "${site.selector}" niet gevonden op de pagina`,
    }
  } catch (err) {
    return {
      status: 'error',
      responseTimeMs: Date.now() - startTime,
      errorMessage: `Fetch fout: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify authorization
    const authHeader = req.headers.get('Authorization')
    const cronSecret = Deno.env.get('CRON_SECRET')

    // Allow either service role key, anon key, or cron secret
    if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
      // Cron trigger - OK
    } else if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Check if a specific site was requested
    let siteFilter: string | null = null
    if (req.method === 'POST') {
      try {
        const body = await req.json()
        siteFilter = body.site_id ?? null
      } catch {
        // No body or invalid JSON - check all sites
      }
    }

    // Fetch active sites
    let query = supabase.from('sites').select('*').eq('is_active', true)
    if (siteFilter) {
      query = query.eq('id', siteFilter)
    }
    const { data: sites, error: sitesError } = await query

    if (sitesError) {
      throw new Error(`Failed to fetch sites: ${sitesError.message}`)
    }

    if (!sites || sites.length === 0) {
      return new Response(JSON.stringify({ message: 'No active sites to check' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const results = []

    for (const site of sites) {
      const result = await checkSite(site)

      // Save check result
      await supabase.from('check_results').insert({
        site_id: site.id,
        status: result.status,
        response_time_ms: result.responseTimeMs,
        error_message: result.errorMessage,
      })

      // Update site status
      await supabase
        .from('sites')
        .update({
          last_status: result.status,
          last_checked_at: new Date().toISOString(),
        })
        .eq('id', site.id)

      // Send notification if error and status changed from ok to error
      if (result.status === 'error' && site.last_status !== 'error') {
        // Get user settings for notification
        const { data: settings } = await supabase
          .from('settings')
          .select('*')
          .eq('user_id', site.user_id)
          .single()

        if (settings?.emailit_api_key && settings?.notification_email) {
          await sendEmailNotification(
            settings.emailit_api_key,
            settings.notification_email,
            site.name,
            site.url,
            site.selector,
            result.errorMessage ?? 'Element niet gevonden',
          )
        }
      }

      results.push({
        site_id: site.id,
        name: site.name,
        ...result,
      })
    }

    return new Response(JSON.stringify({ checked: results.length, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
