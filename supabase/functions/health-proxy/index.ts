// Supabase Edge Function: health-proxy
// Fetches the health-check endpoint of a WordPress site and returns all monitored elements.
// This acts as a CORS proxy so the frontend can read element statuses.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { site_url } = await req.json()

    if (!site_url) {
      return new Response(JSON.stringify({ error: 'site_url is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const siteUrl = new URL(site_url)
    const healthUrl = `${siteUrl.origin}/wp-json/designpixels/v1/health`

    const response = await fetch(healthUrl, {
      headers: {
        'Cache-Control': 'no-cache',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      },
    })

    if (!response.ok) {
      return new Response(JSON.stringify({ error: `Health endpoint returned ${response.status}`, elements: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const data = await response.json()

    if (!data?.results) {
      return new Response(JSON.stringify({ elements: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Transform results into a flat array of elements
    const elements = Object.entries(data.results).map(([path, value]) => {
      const result = value as { found: boolean; element_id?: string }
      return {
        path: path.replace(/\\\//g, '/'),
        found: result.found,
        element_id: result.element_id || null,
      }
    })

    return new Response(JSON.stringify({ elements }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err), elements: [] }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
