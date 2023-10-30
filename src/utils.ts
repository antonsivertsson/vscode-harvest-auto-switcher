import { HarvestResponse } from "./harvest";

export const harvestProjectsToProjectInfo = (projects: HarvestResponse.ProjectAssignments) =>
  projects.project_assignments
    .map((projectAssignment) => ({
      id: projectAssignment.project.id,
      code: projectAssignment.project.code,
      name: projectAssignment.project.name,
      tasks: projectAssignment.task_assignments
        .filter((taskAssign) => taskAssign.is_active)
        .map((taskAssignment) => ({
          id: taskAssignment.task.id,
          name: taskAssignment.task.name,
        }))
    }));

