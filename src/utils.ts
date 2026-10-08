import { HarvestResponse } from "./handlers/harvest"

export const harvestProjectsToProjectInfo = (projects: HarvestResponse.ProjectAssignments) =>
  projects.project_assignments.map((projectAssignment) => ({
    id: projectAssignment.project.id,
    code: projectAssignment.project.code,
    name: projectAssignment.project.name,
    tasks: projectAssignment.task_assignments
      .filter((taskAssign) => taskAssign.is_active)
      .map((taskAssignment) => ({
        id: taskAssignment.task.id,
        name: taskAssignment.task.name,
      })),
  }))

/** Converts float of hours into text of format hh:mm */
export const formatHours = (hours: number) => {
  const h = Math.floor(hours)
  let min = Math.round((hours - h) * 60).toString()
  return `${h < 10 ? `0${h}` : h}:${min.length < 2 ? `0${min}` : min}`
}

/**
 * Takes a number of minutes and converts it into a float where 1 = 1 hour. E.g. 15 mins = 0.25
 * hours.
 */
export const minsToHourFloat = (mins: number) => {
  return mins / 60
}
