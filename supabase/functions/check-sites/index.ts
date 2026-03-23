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

// Check if a simple CSS selector part is present in the HTML using string matching
function matchesSimpleSelector(html: string, selector: string): boolean {
  const lowerHtml = html.toLowerCase()

  // #id → look for id="value" or id='value'
  const idMatch = selector.match(/^#([\w-]+)$/)
  if (idMatch) {
    const id = idMatch[1].toLowerCase()
    return lowerHtml.includes(`id="${id}"`) || lowerHtml.includes(`id='${id}'`)
  }

  // .class → look for the class name in a class attribute
  const classMatch = selector.match(/^\.([\w-]+)$/)
  if (classMatch) {
    return lowerHtml.includes(classMatch[1].toLowerCase())
  }

  // tag#id
  const tagIdMatch = selector.match(/^(\w+)#([\w-]+)$/)
  if (tagIdMatch) {
    const tag = tagIdMatch[1].toLowerCase()
    const id = tagIdMatch[2].toLowerCase()
    return lowerHtml.includes(`<${tag}`) && (lowerHtml.includes(`id="${id}"`) || lowerHtml.includes(`id='${id}'`))
  }

  // tag.class
  const tagClassMatch = selector.match(/^(\w+)\.([\w-]+)$/)
  if (tagClassMatch) {
    return lowerHtml.includes(`<${tagClassMatch[1].toLowerCase()}`) && lowerHtml.includes(tagClassMatch[2].toLowerCase())
  }

  // [attribute=value]
  const attrMatch = selector.match(/^\[([\w-]+)=["']?([^"'\]]+)["']?\]$/)
  if (attrMatch) {
    const attr = attrMatch[1].toLowerCase()
    const val = attrMatch[2].toLowerCase()
    return lowerHtml.includes(`${attr}="${val}"`) || lowerHtml.includes(`${attr}='${val}'`)
  }

  // [attribute]
  const dataAttrMatch = selector.match(/^\[([\w-]+)\]$/)
  if (dataAttrMatch) {
    return lowerHtml.includes(dataAttrMatch[1].toLowerCase())
  }

  // plain tag name → look for <tagname
  const tagMatch = selector.match(/^(\w+)$/)
  if (tagMatch) {
    return lowerHtml.includes(`<${tagMatch[1].toLowerCase()}`)
  }

  return false
}

// Check selector against HTML. Supports descendant selectors like "#id iframe".
// For compound selectors, checks that ALL parts are present in the HTML.
function selectorMatchesHtml(html: string, selector: string): { found: boolean; error: string | null } {
  const parts = selector.trim().split(/\s+/)

  for (const part of parts) {
    if (!matchesSimpleSelector(html, part)) {
      return { found: false, error: null }
    }
  }

  return { found: true, error: null }
}

async function sendEmailNotification(
  apiKey: string,
  toEmail: string,
  siteName: string,
  siteUrl: string,
  selector: string,
  errorMessage: string
) {
  const response = await fetch('https://api.emailit.com/v2/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: 'Site Monitor <noreply@designpixels.nl>',
      to: [toEmail],
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

async function fetchHtml(url: string): Promise<{ html: string; error: string | null }> {
  // Try direct fetch first
  const fetchUrl = new URL(url)
  fetchUrl.searchParams.set('_cb', Date.now().toString())

  const response = await fetch(fetchUrl.toString(), {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'nl-NL,nl;q=0.9,en;q=0.8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
    },
    redirect: 'follow',
  })

  if (!response.ok) {
    return { html: '', error: `HTTP ${response.status}: ${response.statusText}` }
  }

  return { html: await response.text(), error: null }
}

async function checkSite(site: Site): Promise<{ status: 'ok' | 'error'; responseTimeMs: number; errorMessage: string | null }> {
  const startTime = Date.now()

  try {
    // Try Design Pixels Health Check plugin endpoint first
    const siteUrl = new URL(site.url)
    const healthUrl = `${siteUrl.origin}/wp-json/designpixels/v1/health`

    try {
      const healthResponse = await fetch(healthUrl, {
        headers: {
          'Cache-Control': 'no-cache',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        },
      })
      if (healthResponse.ok) {
        const data = await healthResponse.json()
        const responseTimeMs = Date.now() - startTime
        if (data && data.results) {
          // Find the matching path in the health check results
          // Try multiple path formats since WordPress may escape slashes
          const pagePath = siteUrl.pathname.endsWith('/') ? siteUrl.pathname : siteUrl.pathname + '/'
          const pathWithoutTrailing = pagePath.replace(/\/$/, '')

          let result = null
          for (const [key, value] of Object.entries(data.results)) {
            const normalizedKey = (key as string).replace(/\\\//g, '/')
            if (normalizedKey === pagePath || normalizedKey === pathWithoutTrailing || normalizedKey === siteUrl.pathname) {
              result = value as { found: boolean; element_id?: string }
              break
            }
          }

          if (result && typeof result.found === 'boolean') {
            return {
              status: result.found ? 'ok' : 'error',
              responseTimeMs,
              errorMessage: result.found ? null : `Element "${result.element_id || site.selector}" niet gevonden (via health-check)`,
            }
          }
        }
      }
    } catch {
      // Health-check plugin not available, fall back to HTML fetch
    }

    // Fallback: fetch and parse HTML directly
    const { html, error: fetchError } = await fetchHtml(site.url)
    const responseTimeMs = Date.now() - startTime

    if (fetchError) {
      return { status: 'error', responseTimeMs, errorMessage: fetchError }
    }

    const { found, error: selectorError } = selectorMatchesHtml(html, site.selector)

    if (selectorError) {
      return { status: 'error', responseTimeMs, errorMessage: selectorError }
    }

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

    // Handle POST with WordPress plugin push data
    let siteFilter: string | null = null
    let pluginData: { source?: string; site_url?: string; results?: Record<string, { element_id: string; found: boolean; response_time_ms?: number; error?: string }> } | null = null

    if (req.method === 'POST') {
      try {
        const body = await req.json()
        if (body.source === 'wordpress-plugin' && body.results) {
          pluginData = body
        } else {
          siteFilter = body.site_id ?? null
        }
      } catch {
        // No body or invalid JSON - check all sites
      }
    }

    // If WordPress plugin pushed results, process them directly
    if (pluginData && pluginData.results && pluginData.site_url) {
      const siteOrigin = pluginData.site_url.replace(/\/$/, '')

      // Find matching sites in the database
      const { data: allSites } = await supabase.from('sites').select('*').eq('is_active', true)
      const processedResults = []

      for (const site of (allSites || [])) {
        // Match by origin: site.url can be "https://tvrapid.nl" or "https://tvrapid.nl/some-page/"
        let siteUrlObj: URL
        try { siteUrlObj = new URL(site.url) } catch { continue }
        if (siteUrlObj.origin !== siteOrigin) continue

        // If site.url has a specific path, match that path in plugin results
        // If site.url is just the origin (path is "/"), process ALL plugin results for this site
        const sitePath = siteUrlObj.pathname
        const isRootUrl = sitePath === '/' || sitePath === ''

        if (isRootUrl) {
          // Process all plugin results as separate check entries, combine into one status
          let allFound = true
          let firstError: string | null = null
          let totalTimeMs = 0

          for (const [path, result] of Object.entries(pluginData.results)) {
            const r = result as { found: boolean; element_id: string; response_time_ms?: number; error?: string }
            totalTimeMs += r.response_time_ms ?? 0
            if (!r.found) {
              allFound = false
              firstError = `Element "${r.element_id}" niet gevonden op ${path}`
            }
          }

          const status = allFound ? 'ok' : 'error'
          const errorMessage = allFound ? null : firstError

          // Save check result
          await supabase.from('check_results').insert({
            site_id: site.id,
            status,
            response_time_ms: totalTimeMs,
            error_message: errorMessage,
          })

          await supabase.from('sites').update({
            last_status: status,
            last_checked_at: new Date().toISOString(),
          }).eq('id', site.id)

          if (status === 'error' && site.last_status !== 'error') {
            const { data: settings } = await supabase
              .from('settings').select('*').eq('user_id', site.user_id).single()
            if (settings?.emailit_api_key && settings?.notification_email) {
              await sendEmailNotification(
                settings.emailit_api_key, settings.notification_email,
                site.name, site.url, site.selector,
                errorMessage ?? 'Element niet gevonden',
              )
            }
          }

          processedResults.push({ site_id: site.id, name: site.name, status })
          continue
        }

        // Specific path matching
        const normalizedPath = sitePath.endsWith('/') ? sitePath : sitePath + '/'
        let pluginResult = null
        for (const [path, result] of Object.entries(pluginData.results)) {
          const normalizedKey = path.endsWith('/') ? path : path + '/'
          if (normalizedKey === normalizedPath) {
            pluginResult = result
            break
          }
        }

        if (!pluginResult) continue

        const status = pluginResult.found ? 'ok' : 'error'
        const errorMessage = pluginResult.found ? null : `Element "${pluginResult.element_id}" niet gevonden`

        // Save check result
        await supabase.from('check_results').insert({
          site_id: site.id,
          status,
          response_time_ms: pluginResult.response_time_ms ?? null,
          error_message: errorMessage,
        })

        // Update site status
        await supabase.from('sites').update({
          last_status: status,
          last_checked_at: new Date().toISOString(),
        }).eq('id', site.id)

        // Send notification if status changed to error
        if (status === 'error' && site.last_status !== 'error') {
          const { data: settings } = await supabase
            .from('settings').select('*').eq('user_id', site.user_id).single()

          if (settings?.emailit_api_key && settings?.notification_email) {
            await sendEmailNotification(
              settings.emailit_api_key,
              settings.notification_email,
              site.name, site.url, site.selector,
              errorMessage ?? 'Element niet gevonden',
            )
          }
        }

        processedResults.push({ site_id: site.id, name: site.name, status, pluginResult })
      }

      return new Response(JSON.stringify({ source: 'wordpress-plugin', processed: processedResults.length, results: processedResults }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
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
