'use client'

import {
  customerIdForSelectedProject,
  formatTimeReportProjectLabel,
  type MyProjectOption,
} from '@/lib/timeReportForm'

type Props = {
  projects: MyProjectOption[]
  value: string
  isAdmin: boolean
  onChange: (projectId: string, customerId: string | null) => void
  className?: string
}

export default function TimeReportProjectSelect({
  projects,
  value,
  isAdmin,
  onChange,
  className = 'w-full px-4 py-2 border border-gray-300 rounded-md',
}: Props) {
  const assigned = projects.filter((project) => project.isAssigned)
  const other = projects.filter((project) => !project.isAssigned)

  const renderOption = (project: MyProjectOption) => (
    <option key={project.id} value={project.id}>
      {formatTimeReportProjectLabel(project, isAdmin)}
    </option>
  )

  return (
    <select
      value={value}
      onChange={(e) => {
        const projectId = e.target.value
        onChange(projectId, customerIdForSelectedProject(projects, projectId))
      }}
      className={className}
    >
      <option value="">Inget projekt valt</option>
      {isAdmin ? (
        projects.map(renderOption)
      ) : (
        <>
          {assigned.length > 0 ? (
            <optgroup label="Tilldelade dig">
              {assigned.map(renderOption)}
            </optgroup>
          ) : null}
          {other.length > 0 ? (
            <optgroup label={assigned.length > 0 ? 'Övriga projekt' : 'Alla projekt'}>
              {other.map(renderOption)}
            </optgroup>
          ) : null}
        </>
      )}
    </select>
  )
}
