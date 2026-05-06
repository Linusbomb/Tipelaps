'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'

interface Project {
  id: string
  name: string
  address: string
  latitude?: number | null
  longitude?: number | null
  startDate: string
  description: string | null
  customer: {
    id: string
    name: string
  }
  employees: Array<{
    user: {
      id: string
      name: string
      email: string
    }
  }>
  createdAt: string
  accepted?: boolean
  acceptedAt?: string | null
  completed?: boolean
  completedAt?: string | null
  assignedEquipment?: string | null
}

const ProjectReadOnlyMap = dynamic(() => import('../components/ProjectReadOnlyMap'), {
  ssr: false,
})

export default function MyProjectsPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (typeof window === 'undefined') return

    const checkAuth = async () => {
      const token = localStorage.getItem('token')
      const userData = localStorage.getItem('user')
      
      if (!token || !userData) {
        window.location.href = '/login'
        return
      }

      try {
        const parsedUser = JSON.parse(userData)
        setUser(parsedUser)
        fetchProjects()
      } catch (err) {
        console.error('Fel vid parsing av användardata:', err)
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        window.location.href = '/login'
      }
    }

    checkAuth()
  }, [router])

  const fetchProjects = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      const response = await fetch('/api/projects/my-projects', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setProjects(data)
        window.dispatchEvent(new CustomEvent('projects-badge-refresh'))
      } else {
        setError('Kunde inte hämta projekt')
      }
    } catch (err) {
      console.error('Kunde inte hämta projekt:', err)
      setError('Kunde inte hämta projekt')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    router.push('/login')
  }

  // Filtrera projekt - nya projekt är de som skapats de senaste 7 dagarna
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const visibleProjects = projects.filter((p) => !p.completed)
  const unreadProjects = visibleProjects.filter((p) => !p.accepted)
  const newProjects = visibleProjects.filter((p) => new Date(p.createdAt) > sevenDaysAgo)
  const otherProjects = visibleProjects.filter((p) => new Date(p.createdAt) <= sevenDaysAgo)

  if (!user) {
    return <div className="p-8">Laddar...</div>
  }

  return (
    <div className="app-shell-wide max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-8">
        <h1 className="app-title text-gray-900">Mina projekt</h1>
        <div className="flex items-center space-x-4">
          <a
            href="/time-report"
            className="text-primary-600 hover:text-primary-700 px-3 py-2 rounded-md text-sm font-medium"
          >
            Tidrapport
          </a>
          <a
            href="/my-reports"
            className="text-primary-600 hover:text-primary-700 px-3 py-2 rounded-md text-sm font-medium"
          >
            Mina rapporter
          </a>
          <span className="text-gray-700">Hej, {user.name}!</span>
          <button
            onClick={handleLogout}
            className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
          >
            Logga ut
          </button>
        </div>
      </div>

      {unreadProjects.length > 0 && (
        <div className="mb-6 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3">
          <p className="text-sm font-medium text-orange-900">
            Du har {unreadProjects.length} oläst{unreadProjects.length > 1 ? 'a' : ''} projekt att godkänna.
          </p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <div className="bg-white shadow rounded-lg p-8 text-center">
          <p className="text-gray-500">Laddar projekt...</p>
        </div>
      ) : (
        <>
          {/* Olästa projekt */}
          {unreadProjects.length > 0 && (
            <div className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                Olästa projekt
              </h2>
              <div className="space-y-4">
                {unreadProjects.map((project) => (
                  <ProjectCard key={project.id} project={project} isNew={true} onAccept={fetchProjects} />
                ))}
              </div>
            </div>
          )}

          {/* Nya projekt */}
          {newProjects.filter(p => p.accepted).length > 0 && (
            <div className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                Nya projekt
              </h2>
              <div className="space-y-4">
                {newProjects.filter(p => p.accepted).map((project) => (
                  <ProjectCard key={project.id} project={project} isNew={true} onAccept={fetchProjects} />
                ))}
              </div>
            </div>
          )}

          {/* Övriga projekt */}
          {otherProjects.filter(p => p.accepted).length > 0 && (
            <div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                Alla projekt
              </h2>
              <div className="space-y-4">
                {otherProjects.filter(p => p.accepted).map((project) => (
                  <ProjectCard key={project.id} project={project} isNew={false} onAccept={fetchProjects} />
                ))}
              </div>
            </div>
          )}

          {visibleProjects.length === 0 && (
            <div className="bg-white shadow rounded-lg p-8 text-center">
              <p className="text-gray-500">Du har inga aktiva projekt just nu.</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function ProjectCard({ project, isNew, onAccept }: { project: Project; isNew: boolean; onAccept: () => void }) {
  const [accepting, setAccepting] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [accepted, setAccepted] = useState(project.accepted || false)
  const [completed, setCompleted] = useState(project.completed || false)
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false)
  const startDate = new Date(project.startDate)
  const isUpcoming = startDate > new Date()
  const isActive = startDate <= new Date()

  const handleAccept = async () => {
    if (accepted) return

    setAccepting(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/projects/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ projectId: project.id }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Kunde inte acceptera projekt')
      }

      setAccepted(true)
      onAccept() // Uppdatera listan
    } catch (err: any) {
      console.error('Fel vid acceptering:', err)
      alert(err.message || 'Kunde inte acceptera projekt')
    } finally {
      setAccepting(false)
    }
  }

  const handleProjectClick = async () => {
    if (accepted) return

    const confirmRead = window.confirm(
      'Har du tagit del av informationen för detta projekt och vill godkänna?'
    )
    if (!confirmRead) return
    await handleAccept()
  }

  const handleComplete = async () => {
    if (!accepted || completed) return
    setCompleting(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/projects/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ projectId: project.id }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Kunde inte slutföra projekt')
      }

      setCompleted(true)
      setShowCompleteConfirm(false)
      onAccept()
    } catch (err: any) {
      console.error('Fel vid slutförande:', err)
      alert(err.message || 'Kunde inte markera projekt som slutfört')
    } finally {
      setCompleting(false)
    }
  }

  const copyInfoToNewTimeReport = () => {
    const payload = {
      customerId: project.customer.id,
      customerName: project.customer.name,
      address: project.address,
      copiedAt: new Date().toISOString(),
    }
    localStorage.setItem('prefillTimeReportFromProject', JSON.stringify(payload))
    window.location.href = '/time-report'
  }

  return (
    <div className={`bg-white shadow rounded-lg p-6 border-l-4 relative ${
      isNew 
        ? 'border-blue-500 bg-blue-50' 
        : isUpcoming 
        ? 'border-green-500' 
        : 'border-gray-300'
    }`}>
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <button
              type="button"
              onClick={handleProjectClick}
              className="text-xl font-semibold text-gray-900 text-left hover:text-primary-700"
            >
              {project.name}
            </button>
            {isNew && (
              <span className="px-2 py-1 text-xs font-semibold bg-blue-600 text-white rounded">
                NYTT
              </span>
            )}
            {isUpcoming && (
              <span className="px-2 py-1 text-xs font-semibold bg-green-600 text-white rounded">
                Kommande
              </span>
            )}
            {isActive && !isUpcoming && (
              <span className="px-2 py-1 text-xs font-semibold bg-gray-600 text-white rounded">
                Aktivt
              </span>
            )}
            {accepted && (
              <span className="px-2 py-1 text-xs font-semibold bg-green-500 text-white rounded">
                Accepterat
              </span>
            )}
            {completed && (
              <span className="px-2 py-1 text-xs font-semibold bg-emerald-700 text-white rounded">
                Slutfört
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600 mb-1">
            <strong>Kund:</strong> {project.customer.name}
          </p>
          <p className="text-sm text-gray-600 mb-1">
            <strong>Adress:</strong> {project.address}
          </p>
          <p className="text-sm text-gray-600">
            <strong>Startdatum:</strong> {format(startDate, 'd MMMM yyyy', { locale: sv })}
          </p>
          {project.assignedEquipment && (
            <p className="text-sm text-gray-600 mt-1">
              <strong>Tilldelat fordon:</strong> {project.assignedEquipment}
            </p>
          )}
        </div>
        <div className="ml-4">
          {!accepted ? (
            <button
              onClick={handleProjectClick}
              disabled={accepting}
              className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 font-medium"
            >
              {accepting ? 'Godkänner...' : 'Öppna & godkänn'}
            </button>
          ) : !completed ? (
            <button
              onClick={() => setShowCompleteConfirm(true)}
              disabled={completing}
              className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50 font-medium"
            >
              {completing ? 'Markerar...' : 'Slutfört projekt'}
            </button>
          ) : (
            <div className="px-4 py-2 bg-green-100 text-green-800 rounded-md font-medium">
              ✓ Projekt slutfört
            </div>
          )}
        </div>
      </div>

      {project.description && (
        <div className="mt-4 p-3 bg-gray-50 rounded-md">
          <p className="text-sm font-medium text-gray-700 mb-1">Information:</p>
          <p className="text-sm text-gray-600 whitespace-pre-wrap">{project.description}</p>
        </div>
      )}

      {typeof project.latitude === 'number' && typeof project.longitude === 'number' && (
        <div className="mt-4">
          <p className="text-sm font-medium text-gray-700 mb-2">Plats på karta</p>
          <ProjectReadOnlyMap latitude={project.latitude} longitude={project.longitude} />
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          <strong>Medarbetare på projektet:</strong>{' '}
          {project.employees.map(e => e.user.name).join(', ')}
        </p>
        <button
          type="button"
          onClick={copyInfoToNewTimeReport}
          className="mt-3 text-sm underline"
          style={{ color: '#2D5016' }}
        >
          Kopiera information till ny tidrapport
        </button>
      </div>

      {showCompleteConfirm && (
        <div className="absolute inset-0 bg-black/40 rounded-lg flex items-center justify-center p-4">
          <div className="bg-white rounded-md shadow-lg p-4 w-full max-w-md">
            <p className="text-sm text-gray-900 mb-4">
              Är du säker på att du vill avsluta projektet?
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCompleteConfirm(false)}
                className="px-4 py-2 rounded-md border border-gray-300 text-gray-700"
                disabled={completing}
              >
                NEJ
              </button>
              <button
                type="button"
                onClick={handleComplete}
                className="px-4 py-2 rounded-md text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
                disabled={completing}
              >
                {completing ? 'Sparar...' : 'JA'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
