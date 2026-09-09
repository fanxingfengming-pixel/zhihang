import type { CareerProfile } from "@/lib/schemas";

export type ResumeExportProject = {
  title: string;
  organization: string;
  period: string;
  role: string;
  details: string[];
  result: string;
};

export type ResumeExportContent = {
  name: string;
  targetRole: string;
  contactLine: string;
  school: string;
  educationLine: string;
  skills: string[];
  strengths: string[];
  projects: ResumeExportProject[];
};

const MAX_FIELD_LENGTH = 500;
const MAX_DETAIL_LENGTH = 1_500;

function cleanText(value: string | undefined, maxLength = MAX_FIELD_LENGTH) {
  return (value || "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u200b-\u200f\u2060-\u206f\ufeff]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function cleanList(values: string[], maxItems: number, maxLength = MAX_DETAIL_LENGTH) {
  return [...new Set(values.map((value) => cleanText(value, maxLength)).filter(Boolean))].slice(0, maxItems);
}

export function buildResumeExportContent(profile: CareerProfile): ResumeExportContent {
  const basics = profile.basics;
  const location = cleanText(basics.location);
  const careerStage = cleanText(basics.careerStage);
  const industry = cleanText(basics.industry);

  return {
    name: cleanText(basics.name),
    targetRole: cleanText(basics.targetRole),
    contactLine: [location, careerStage, industry].filter(Boolean).join(" · "),
    school: cleanText(basics.school),
    educationLine: [cleanText(basics.major), cleanText(basics.grade)].filter(Boolean).join(" · "),
    skills: cleanList(profile.skills, 40),
    strengths: cleanList(profile.strengths, 24),
    projects: profile.projects.slice(0, 20).map((project) => ({
      title: cleanText(project.title),
      organization: cleanText(project.organization),
      period: cleanText(project.period),
      role: cleanText(project.role),
      details: cleanList(project.details, 20),
      result: cleanText(project.result, MAX_DETAIL_LENGTH),
    })).filter((project) => project.title || project.organization || project.role || project.details.length || project.result),
  };
}

export function hasResumeExportContent(profile: CareerProfile) {
  const content = buildResumeExportContent(profile);
  return Boolean(
    content.name
    || content.targetRole
    || content.school
    || content.educationLine
    || content.skills.length
    || content.strengths.length
    || content.projects.length,
  );
}

export function buildResumeFilename(profile: CareerProfile, format: "pdf" | "docx") {
  const content = buildResumeExportContent(profile);
  const stem = [content.name, content.targetRole, "简历"].filter(Boolean).join("-") || "职航简历";
  const safeStem = stem
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/[. ]+$/g, "")
    .replace(/-+/g, "-")
    .slice(0, 80) || "职航简历";
  return `${safeStem}.${format}`;
}
