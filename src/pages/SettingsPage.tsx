import { useState, useEffect } from 'react'
import { useSettings } from '../hooks/useSettings'
import { ArrowLeft, Save } from 'lucide-react'
import { Link } from 'react-router-dom'

export function SettingsPage() {
  const { settings, loading, saveSettings } = useSettings()
  const [apiKey, setApiKey] = useState('')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (settings) {
      setApiKey(settings.emailit_api_key ?? '')
      setEmail(settings.notification_email ?? '')
    }
  }, [settings])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage(null)

    const { error } = await saveSettings({
      emailit_api_key: apiKey || null,
      notification_email: email || null,
    })

    setMessage(error ? `Fout: ${error.message}` : 'Instellingen opgeslagen!')
    setSaving(false)
  }

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Laden...</div>
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft size={16} />
          Terug naar dashboard
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">Instellingen</h1>

      <form onSubmit={handleSave} className="bg-white rounded-lg shadow-md p-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-4">EmailIt Configuratie</h2>
          <p className="text-sm text-gray-500 mb-4">
            Maak een account aan op emailit.com en genereer een API key om notificaties te ontvangen.
          </p>

          <div className="space-y-4">
            <div>
              <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700 mb-1">
                API Key
              </label>
              <input
                id="apiKey"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Jouw EmailIt API key"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label htmlFor="notifEmail" className="block text-sm font-medium text-gray-700 mb-1">
                Notificatie emailadres
              </label>
              <input
                id="notifEmail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jouw@email.nl"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {message && (
          <p className={`text-sm ${message.startsWith('Fout') ? 'text-red-600' : 'text-green-600'}`}>
            {message}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          <Save size={16} />
          {saving ? 'Opslaan...' : 'Opslaan'}
        </button>
      </form>
    </div>
  )
}
