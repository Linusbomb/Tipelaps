'use client'

import { useState, useEffect, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import ProjectMyHoursPanel from '../components/ProjectMyHoursPanel'

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

function projectMatchesSearch(project: Project, needle: string): boolean {
  if (!needle) return true
  const blob = [
    project.name,
    project.address,
    project.customer.name,
    project.description ?? '',
    ...project.employees.map((e) => e.user.name),
  ]
    .join(' ')
    .toLowerCase()
  return blob.includes(needle)
}

function MyProjectsPageContent() {
  const searchParams = useSearchParams()
  const requestedProjectId = searchParams.get('projectId')
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [projectSearch, setProjectSearch] = useState('')
  const [listTab, setListTab] = useState<'active' | 'completed'>('active')

  useEffect(() => {
    if (typeof window === 'undefined') return

    const token = localStorage.getItem('token')
    const userData = localStorage.getItem('user')

    if (!token || !userData) {
      window.location.href = '/login'
      return
    }

    fetchProjects()
  }, [])

  const fetchProjects = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      const response = await fetch('/api/projects/my-projects', {
        headers: {
          Authorization: `Bearer ${token}`,
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

  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const searchNeedle = projectSearch.trim().toLowerCase()

  const activeProjects = useMemo(
    () => projects.filter((p) => !p.completed).filter((p) => projectMatchesSearch(p, searchNeedle)),
    [projects, searchNeedle]
  )

  const completedProjects = useMemo(
    () =>
      projects
        .filter((p) => p.completed)
        .filter((p) => projectMatchesSearch(p, searchNeedle))
        .sort((a, b) => {
          const aMs = a.completedAt ? new Date(a.completedAt).getTime() : 0
          const bMs = b.completedAt ? new Date(b.completedAt).getTime() : 0
          return bMs - aMs
        }),
    [projects, searchNeedle]
  )

  const unreadProjects = activeProjects.filter((p) => !p.accepted)
  const newProjects = activeProjects.filter(
    (p) => p.accepted && new Date(p.createdAt) > sevenDaysAgo
  )
  const otherProjects = activeProjects.filter(
    (p) => p.accepted && new Date(p.createdAt) <= sevenDaysAgo
  )

  useEffect(() => {
    if (!requestedProjectId || loading || projects.length === 0) return
    const exists = projects.some((project) => project.id === requestedProjectId)
    if (!exists) return
    const target = projects.find((p) => p.id === requestedProjectId)
    if (target?.completed) setListTab('completed')
    const element = document.getElementById(`project-card-${requestedProjectId}`)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [requestedProjectId, loading, projects])

  return (
    <div className="app-shell-wide max-w-6xl">
      {unreadProjects.length > 0 && listTab === 'active' && (
        <div className="mb-6 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3">
          <p className="text-sm font-medium text-orange-900">
            Du har {unreadProjects.length} oläst{unreadProjects.length > 1 ? 'a' : ''} projekt att godkänna.
          </p>
        </div>
      )}

      <div className="mb-6 flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="flex rounded-lg border border-gray-200 p-1 bg-gray-50">
          <button
            type="button"
            onClick={() => setListTab('active')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition ${
              listTab === 'active' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Aktiva ({projects.filter((p) => !p.completed).length})
          </button>
          <button
            type="button"
            onClick={() => setListTab('completed')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition ${
              listTab === 'completed'
                ? 'bg-white shadow text-gray-900'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Avslutade ({projects.filter((p) => p.completed).length})
          </button>
        </div>
        <div className="flex-1 sm:max-w-md">
          <label htmlFor="project-search" className="sr-only">
            Sök projekt
          </label>
          <input
            id="project-search"
            type="search"
            value={projectSearch}
            onChange={(e) => setProjectSearch(e.target.value)}
            placeholder="Sök projekt (namn, kund, adress)..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <div className="bg-white shadow rounded-lg p-8 text-center">
          <p className="text-gray-500">Laddar projekt...</p>
        </div>
      ) : listTab === 'active' ? (
        <>
          {unreadProjects.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Olästa projekt</h2>
              <div className="space-y-4">
                {unreadProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    isNew={true}
                    onAccept={fetchProjects}
                    highlighted={requestedProjectId === project.id}
                  />
                ))}
              </div>
            </div>
          )}

          {newProjects.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Nya projekt</h2>
              <div className="space-y-4">
                {newProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    isNew={true}
                    onAccept={fetchProjects}
                    highlighted={requestedProjectId === project.id}
                  />
                ))}
              </div>
            </div>
          )}

          {otherProjects.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Alla projekt</h2>
              <div className="space-y-4">
                {otherProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    isNew={false}
                    onAccept={fetchProjects}
                    highlighted={requestedProjectId === project.id}
                  />
                ))}
              </div>
            </div>
          )}

          {activeProjects.length === 0 && (
            <div className="bg-white shadow rounded-lg p-8 text-center">
              <p className="text-gray-500">
                {searchNeedle
                  ? 'Inga aktiva projekt matchar sökningen.'
                  : 'Du har inga aktiva projekt just nu.'}
              </p>
            </div>
          )}
        </>
      ) : completedProjects.length > 0 ? (
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Avslutade projekt</h2>
          <div className="space-y-4">
            {completedProjects.map((project) => (
              <CompletedProjectCard
                key={project.id}
                project={project}
                highlighted={requestedProjectId === project.id}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg p-8 text-center">
          <p className="text-gray-500">
            {searchNeedle
              ? 'Inga avslutade projekt matchar sökningen.'
              : 'Du har inga avslutade projekt ännu.'}
          </p>
        </div>
      )}
    </div>
  )
}

function CompletedProjectCard({
  project,
  highlighted = false,
}: {
  project: Project
  highlighted?: boolean
}) {
  const startDate = new Date(project.startDate)
  const completedAt = project.completedAt ? new Date(project.completedAt) : null

  return (
    <div
      id={`project-card-${project.id}`}
      className={`bg-white shadow rounded-lg p-6 border-l-4 border-emerald-700 ${
        highlighted ? 'ring-2 ring-green-700' : ''
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">{project.name}</h3>
          <span className="inline-block mt-1 px-2 py-1 text-xs font-semibold bg-emerald-700 text-white rounded">
            Slutfört
          </span>
        </div>
        {completedAt && (
          <p className="text-sm text-emerald-900 font-medium">
            Avslutat: {format(completedAt, 'd MMMM yyyy HH:mm', { locale: sv })}
          </p>
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
      {project.description && (
        <div className="mt-4 p-3 bg-gray-50 rounded-md">
          <p className="text-sm text-gray-600 whitespace-pre-wrap">{project.description}</p>
        </div>
      )}
      <ProjectMyHoursPanel projectId={project.id} showInfoText={false} />
    </div>
  )
}

function ProjectCard({
  project,
  isNew,
  onAccept,
  highlighted = false,
}: {
  project: Project
  isNew: boolean
  onAccept: () => void
  highlighted?: boolean
}) {
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
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ projectId: project.id }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Kunde inte acceptera projekt')
      }

      setAccepted(true)
      onAccept()
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
          Authorization: `Bearer ${token}`,
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
    const descriptionParts = [`Projekt: ${project.name}`]
    if (project.address?.trim()) descriptionParts.push(`Adress: ${project.address.trim()}`)
    if (project.description?.trim()) descriptionParts.push(project.description.trim())
    if (project.assignedEquipment?.trim()) {
      descriptionParts.push(`Tilldelat fordon: ${project.assignedEquipment.trim()}`)
    }

    const payload = {
      projectId: project.id,
      projectName: project.name,
      customerId: project.customer.id,
      customerName: project.customer.name,
      address: project.address,
      description: descriptionParts.join('\n'),
      assignedEquipment: project.assignedEquipment || '',
      copiedAt: new Date().toISOString(),
    }
    localStorage.setItem('prefillTimeReportFromProject', JSON.stringify(payload))
    window.location.href = '/time-report'
  }

  return (
    <div
      id={`project-card-${project.id}`}
      className={`bg-white shadow rounded-lg p-6 border-l-4 relative ${
        highlighted
          ? 'ring-2 ring-green-700 border-green-700'
          : isNew
            ? 'border-blue-500 bg-blue-50'
            : isUpcoming
              ? 'border-green-500'
              : 'border-gray-300'
      }`}
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
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
          ) : (
            <button
              onClick={() => setShowCompleteConfirm(true)}
              disabled={completing}
              className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50 font-medium"
            >
              {completing ? 'Markerar...' : 'Slutfört projekt'}
            </button>
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
          {project.employees.map((e) => e.user.name).join(', ')}
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

      {accepted && <ProjectMyHoursPanel projectId={project.id} />}

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

export default function MyProjectsPage() {
  return (
    <Suspense
      fallback={
        <div className="app-shell-wide max-w-6xl">
          <p className="text-gray-700 py-8">Laddar...</p>
        </div>
      }
    >
      <MyProjectsPageContent />
    </Suspense>
  )
}
