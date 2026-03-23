import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Settings, LogOut } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useSites } from '../hooks/useSites'
import { SiteCard } from '../components/SiteCard'
import { AddSiteModal } from '../components/AddSiteModal'

export function DashboardPage() {
  const { signOut } = useAuth()
  const { sites, loading, fetchSites, addSite, deleteSite, toggleSite } = useSites()
  const [showAddModal, setShowAddModal] = useState(false)

  const okCount = sites.filter(s => s.last_status === 'ok').length
  const errorCount = sites.filter(s => s.last_status === 'error').length
  const activeCount = sites.filter(s => s.is_active).length

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Site Monitor</h1>
          <p className="text-sm text-gray-500">Monitor je websites op ontbrekende elementen</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/settings"
            className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            <Settings size={16} />
            Instellingen
          </Link>
          <button
            onClick={signOut}
            className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            <LogOut size={16} />
            Uitloggen
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow-sm p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{activeCount}</p>
          <p className="text-sm text-gray-500">Actieve sites</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{okCount}</p>
          <p className="text-sm text-gray-500">OK</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4 text-center">
          <p className="text-2xl font-bold text-red-600">{errorCount}</p>
          <p className="text-sm text-gray-500">Fouten</p>
        </div>
      </div>

      {/* Add button */}
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors text-sm"
        >
          <Plus size={16} />
          Site toevoegen
        </button>
      </div>

      {/* Sites list */}
      {loading ? (
        <p className="text-center text-gray-500 py-12">Laden...</p>
      ) : sites.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow-sm">
          <p className="text-gray-500 mb-4">Nog geen sites toegevoegd.</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm"
          >
            <Plus size={16} />
            Voeg je eerste site toe
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {sites.map((site) => (
            <SiteCard
              key={site.id}
              site={site}
              onDelete={deleteSite}
              onToggle={toggleSite}
              onRefresh={fetchSites}
            />
          ))}
        </div>
      )}

      {showAddModal && (
        <AddSiteModal onAdd={addSite} onClose={() => setShowAddModal(false)} />
      )}
    </div>
  )
}
