import { useState } from 'react'
import { X } from 'lucide-react'
import type { Site } from '../types/database'

interface Props {
  site: Site
  onUpdate: (id: string, updates: { name: string; url: string; dashboard_url: string | null }) => Promise<{ error: unknown }>
  onClose: () => void
}

export function EditSiteModal({ site, onUpdate, onClose }: Props) {
  const [name, setName] = useState(site.name)
  const [url, setUrl] = useState(site.url)
  const [dashboardUrl, setDashboardUrl] = useState(site.dashboard_url || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await onUpdate(site.id, {
      name,
      url,
      dashboard_url: dashboardUrl.trim() || null,
    })
    if (error) {
      setError(String(error))
      setLoading(false)
    } else {
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Site bewerken</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="edit-name" className="block text-sm font-medium text-gray-700 mb-1">
              Naam
            </label>
            <input
              id="edit-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="edit-url" className="block text-sm font-medium text-gray-700 mb-1">
              Site URL
            </label>
            <input
              id="edit-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="edit-dashboard" className="block text-sm font-medium text-gray-700 mb-1">
              Dashboard URL
            </label>
            <input
              id="edit-dashboard"
              type="url"
              value={dashboardUrl}
              onChange={(e) => setDashboardUrl(e.target.value)}
              placeholder="https://voorbeeld.nl/wp-admin"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="mt-1 text-xs text-gray-500">
              Optioneel. Link naar het WordPress dashboard om snel in te loggen.
            </p>
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
            >
              Annuleren
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Opslaan...' : 'Opslaan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
