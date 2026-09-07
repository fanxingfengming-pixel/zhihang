import type { CareerProfile } from "@/lib/schemas";

export function calculateProfileCompletion(profile: CareerProfile) {
  const coreFields = [
    profile.basics.name,
    profile.basics.school,
    profile.basics.major,
    profile.basics.grade,
    profile.basics.targetRole,
  ];
  const completedItems = coreFields.filter((value) => value.trim()).length
    + Number(profile.skills.length > 0)
    + Number(profile.projects.length > 0);

  return Math.round((completedItems / 7) * 100);
}

export function countProjectsMissingResults(profile: CareerProfile) {
  return profile.projects.filter((project) => !project.result.trim()).length;
}
