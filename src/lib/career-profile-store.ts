import { CareerProfileSchema, EMPTY_PROFILE, type CareerProfile } from "@/lib/schemas";
import type { ResumeDraft } from "@/lib/resume-draft";
import { readLocalStorageItem, removeLocalStorageItem, writeLocalStorageItem } from "@/lib/browser-storage";

export const CAREER_PROFILE_STORAGE_KEY = "zhihang-career-profile:v1";
export const CAREER_PROFILE_EVENT = "zhihang-career-profile-change";
const LEGACY_CAREER_PROFILE_STORAGE_KEY = "zhihang-career-profile";

export const DEFAULT_CAREER_PROFILE: CareerProfile = EMPTY_PROFILE;

export function loadCareerProfile() {
  if (typeof window === "undefined") return null;
  const saved = readLocalStorageItem(CAREER_PROFILE_STORAGE_KEY, LEGACY_CAREER_PROFILE_STORAGE_KEY);
  if (!saved) return null;
  try {
    const parsed = CareerProfileSchema.safeParse(JSON.parse(saved));
    if (parsed.success) return parsed.data;
  } catch {
    // A malformed local draft should never prevent the workspace from opening.
  }
  removeLocalStorageItem(CAREER_PROFILE_STORAGE_KEY);
  return null;
}

export function saveCareerProfile(profile: CareerProfile) {
  if (!writeLocalStorageItem(CAREER_PROFILE_STORAGE_KEY, JSON.stringify(profile))) return false;
  window.dispatchEvent(new Event(CAREER_PROFILE_EVENT));
  return true;
}

export function getCareerProfileSnapshot() {
  return readLocalStorageItem(CAREER_PROFILE_STORAGE_KEY, LEGACY_CAREER_PROFILE_STORAGE_KEY);
}

export function subscribeCareerProfile(onStoreChange: () => void) {
  function handleStorage(event: StorageEvent) {
    if ([CAREER_PROFILE_STORAGE_KEY, LEGACY_CAREER_PROFILE_STORAGE_KEY].includes(event.key || "")) onStoreChange();
  }
  window.addEventListener("storage", handleStorage);
  window.addEventListener(CAREER_PROFILE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(CAREER_PROFILE_EVENT, onStoreChange);
  };
}

export function parseCareerProfileSnapshot(snapshot: string | null) {
  if (!snapshot) return DEFAULT_CAREER_PROFILE;
  try {
    const parsed = CareerProfileSchema.safeParse(JSON.parse(snapshot));
    return parsed.success ? parsed.data : DEFAULT_CAREER_PROFILE;
  } catch {
    return DEFAULT_CAREER_PROFILE;
  }
}

export function careerProfileToResumeDraft(profile: CareerProfile): ResumeDraft {
  const project = profile.projects[0];
  const projectText = project
    ? [...project.details, project.result].filter(Boolean).join("；")
    : "暂未添加项目经历，可重新打开对话生成器继续补充。";
  return {
    name: profile.basics.name || "同学",
    education: [profile.basics.school, profile.basics.major, profile.basics.grade].filter(Boolean).join(" · ") || "教育信息待补充",
    targetRole: profile.basics.targetRole || "求职方向待明确",
    skills: profile.skills,
    projectName: project?.title || "项目经历待补充",
    projectText,
  };
}

export function careerProfileToMarkdown(profile: CareerProfile) {
  const education = [profile.basics.school, profile.basics.major, profile.basics.grade].filter(Boolean).join(" · ");
  const projects = profile.projects.map((project) => [
    `### ${project.title}`,
    [project.organization, project.role, project.period].filter(Boolean).join(" · "),
    ...project.details.map((detail) => `- ${detail}`),
    ...(project.result ? [`- ${project.result}`] : []),
  ].filter(Boolean).join("\n")).join("\n\n");

  return [
    `# ${profile.basics.name || "姓名待补充"}`,
    profile.basics.targetRole ? `**求职方向：** ${profile.basics.targetRole}` : "",
    education ? `## 教育背景\n${education}` : "",
    profile.skills.length ? `## 核心技能\n${profile.skills.map((skill) => `- ${skill}`).join("\n")}` : "",
    projects ? `## 项目经历\n${projects}` : "",
  ].filter(Boolean).join("\n\n");
}
