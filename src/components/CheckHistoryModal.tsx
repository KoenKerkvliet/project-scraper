import { useEffect } from 'react'
import { X, CheckCircle, XCircle } from 'lucide-react'
import { useCheckResults } from '../hooks/useCheckResults'

interface Props {
  siteId: string
  siteName: string
  onClose: () => void
}

export function CheckHistoryModal({ siteId, siteName, onClose }: Props) {
  const { results, loading, fetchResults } = useCheckResults(siteId)

  useEffect(() => { fetchResults() }, [fetchResults])

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">
            Historie: {siteName}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <p className="text-center text-gray-500 py-8">Laden...</p>
          ) : results.length === 0 ? (
            <p className="text-center text-gray-500 py-8">Nog geen checks uitgevoerd.</p>
          ) : (
            <div className="space-y-2">
              {results.map((result) => (
                <div
                  key={result.id}
                  className={`flex items-start gap-3 p-3 rounded-md ${
                    result.status === 'ok' ? 'bg-green-50' : 'bg-red-50'
                  }`}
                >
                  {result.status === 'ok' ? (
                    <CheckCircle size={18} className="text-green-600 mt-0.5 shrink-0" />
                  ) : (
                    <XCircle size={18} className="text-red-600 mt-0.5 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-medium ${
                        result.status === 'ok' ? 'text-green-800' : 'text-red-800'
                      }`}>
                        {result.status === 'ok' ? 'Element gevonden' : 'Element niet gevonden'}
                      </span>
                      {result.response_time_ms && (
                        <span className="text-xs text-gray-500">{result.response_time_ms}ms</span>
                      )}
                    </div>
                    {result.error_message && (
                      <p className="text-xs text-red-600 mt-1">{result.error_message}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(result.checked_at).toLocaleString('nl-NL')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
