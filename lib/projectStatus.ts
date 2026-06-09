export function isCompanyProjectActive(employees: Array<{ completed: boolean }>) {
  return !employees.some((employee) => employee.completed)
}

export function isProjectSelectableForTimeReport(
  employees: Array<{ userId: string; completed: boolean }>,
  userId: string
) {
  if (!isCompanyProjectActive(employees)) return false
  const assignment = employees.find((employee) => employee.userId === userId)
  if (assignment?.completed) return false
  return true
}

export function isUserAssignedToProject(
  employees: Array<{ userId: string }>,
  userId: string
) {
  return employees.some((employee) => employee.userId === userId)
}
