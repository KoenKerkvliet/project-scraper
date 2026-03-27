import { useState } from 'react'
import { Trash2, Power, ExternalLink, History, RefreshCw, Pencil, LayoutDashboard, ChevronDown, ChevronUp, Circle } from 'lucide-react'
import type { Site } from '../types/database'
import { CheckHistoryModal } from './CheckHistoryModal'
import { EditSiteModal } from './EditSiteModal'
import { useHealthElements } from '../hooks/useHealthElements'

interface Props {
  site: Site
  onDelete: (id: string) => Promise<{ error: unknown }>
  onToggle: (id: string, isActive: boolean) => Promise<{ error: unknown }>
  onUpdate: (id: string, updates: { name: string; url: string; dashboard_url: string | null }) => Promise<{ error: unknown }>
  onRefresh: () => void
}

export function SiteCard({ site, onDelete, onToggle, onUpdate, onRefresh }: Props) {
  const [showHistory, setShowHistory] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [checking, setChecking] = useState(false)
  const [showElements, setShowElements] = useState(false)
  const { elements, loading: elementsLoading, loaded: elementsLoaded, fetchElements } = useHealthElements(site.url)

  const statusColor = {
    ok: 'bg-green-500',
    error: 'bg-red-500',
    pending: 'bg-yellow-500',
  }[site.last_status]

  const statusLabel = {
    ok: 'OK',
    error: 'Fout',
    pending: 'Wachtend',
  }[site.last_status]

  const handleManualCheck = async () => {
    setChecking(true)
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
      await fetch(`${supabaseUrl}/functions/v1/check-sites`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ site_id: site.id }),
      })

      await new Promise(r => setTimeout(r, 2000))
      onRefresh()
    } catch {
      // Edge function might not be deployed yet
    }
    setChecking(false)
  }

  const handleToggleElements = () => {
    if (!showElements && !elementsLoaded) {
      fetchElements()
    }
    setShowElements(!showElements)
  }

  const timeAgo = (dateStr: string | null) => {
    if (!dateStr) return 'Nog niet gecheckt'
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Zojuist'
    if (mins < 60) return `${mins} min geleden`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours} uur geleden`
    return `${Math.floor(hours / 24)} dagen geleden`
  }

  const siteOrigin = (() => {
    try {
      return new URL(site.url).origin
    } catch {
      return site.url
    }
  })()

  return (
    <>
      <div className={`bg-white rounded-lg shadow-md p-5 border-l-4 ${
        site.last_status === 'ok' ? 'border-l-green-500' :
        site.last_status === 'error' ? 'border-l-red-500' : 'border-l-yellow-500'
      } ${!site.is_active ? 'opacity-60' : ''}`}>
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 truncate">{site.name}</h3>
            <div className="flex items-center gap-2">
              <a
                href={site.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:text-blue-800 inline-flex items-center gap-1 truncate"
              >
                {site.url}
                <ExternalLink size={12} />
              </a>
              {site.dashboard_url && (
                <a
                  href={site.dashboard_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600 transition-colors shrink-0"
                  title="Open dashboard"
                >
                  <LayoutDashboard size={13} />
                </a>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 ml-3">
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium text-white ${statusColor}`}>
              {statusLabel}
            </span>
          </div>
        </div>

        <div className="text-sm text-gray-500 mb-3">
          <p>{timeAgo(site.last_checked_at)}</p>
        </div>

        {/* Element status icons */}
        <button
          onClick={handleToggleElements}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors mb-3 w-full"
        >
          {showElements ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          Elementen
          {elementsLoaded && !elementsLoading && elements.length > 0 && (
            <span className="flex items-center gap-1 ml-1">
              {elements.map((el, i) => (
                <Circle
                  key={i}
                  size={8}
                  className={el.found ? 'text-green-500 fill-green-500' : 'text-red-500 fill-red-500'}
                />
              ))}
            </span>
          )}
        </button>

        {showElements && (
          <div className="mb-3 rounded-md border border-gray-100 bg-gray-50 p-2.5">
            {elementsLoading ? (
              <p className="text-xs text-gray-400">Laden...</p>
            ) : elements.length === 0 ? (
              <p className="text-xs text-gray-400">Geen elementen gevonden via health-check.</p>
            ) : (
              <div className="space-y-1.5">
                {elements.map((el, i) => (
                  <a
                    key={i}
                    href={`${siteOrigin}${el.path}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-xs hover:bg-white rounded px-1.5 py-1 transition-colors group"
                  >
                    <Circle
                      size={8}
                      className={`shrink-0 ${el.found ? 'text-green-500 fill-green-500' : 'text-red-500 fill-red-500'}`}
                    />
                    <span className="text-gray-700 group-hover:text-blue-600 truncate">
                      {el.path}
                    </span>
                    {el.element_id && (
                      <span className="text-gray-400 truncate shrink-0">
                        ({el.element_id})
                      </span>
                    )}
                    <ExternalLink size={10} className="text-gray-300 group-hover:text-blue-400 shrink-0 ml-auto" />
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
          <button
            onClick={handleManualCheck}
            disabled={checking}
            className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-blue-600 transition-colors disabled:opacity-50"
            title="Nu checken"
          >
            <RefreshCw size={14} className={checking ? 'animate-spin' : ''} />
            Check
          </button>
          <button
            onClick={() => setShowHistory(true)}
            className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-blue-600 transition-colors"
            title="Check historie"
          >
            <History size={14} />
            Historie
          </button>
          <button
            onClick={() => setShowEdit(true)}
            className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-blue-600 transition-colors"
            title="Bewerken"
          >
            <Pencil size={14} />
            Bewerk
          </button>
          <button
            onClick={() => onToggle(site.id, !site.is_active)}
            className={`inline-flex items-center gap-1 text-sm transition-colors ${
              site.is_active ? 'text-green-600 hover:text-yellow-600' : 'text-gray-400 hover:text-green-600'
            }`}
            title={site.is_active ? 'Deactiveren' : 'Activeren'}
          >
            <Power size={14} />
            {site.is_active ? 'Aan' : 'Uit'}
          </button>
          <button
            onClick={() => { if (confirm('Weet je zeker dat je deze site wilt verwijderen?')) onDelete(site.id) }}
            className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-red-600 transition-colors ml-auto"
            title="Verwijderen"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {showHistory && (
        <CheckHistoryModal siteId={site.id} siteName={site.name} onClose={() => setShowHistory(false)} />
      )}

      {showEdit && (
        <EditSiteModal site={site} onUpdate={onUpdate} onClose={() => setShowEdit(false)} />
      )}
    </>
  )
}
