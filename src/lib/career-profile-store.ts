import { CareerProfileSchema, type CareerProfile } from "@/lib/schemas";
import { defaultResumeDraft, type ResumeDraft } from "@/lib/resume-draft";

export const CAREER_PROFILE_STORAGE_KEY = "zhihang-career-profile";
export const CAREER_PROFILE_EVENT = "zhihang-career-profile-change";

export const DEFAULT_CAREER_PROFILE: CareerProfile = {
  basics: {
    name: defaultResumeDraft.name,
    school: "浙江大学",
    major: "工业设计",
    grade: "2027 届",
    targetRole: defaultResumeDraft.targetRole,
    location: "杭州 / 上海",
  },
  skills: defaultResumeDraft.skills,
  strengths: ["产品设计", "用户研究", "AI 工具实践"],
  projects: [{
    title: defaultResumeDraft.projectName,
    organization: "个人 / 校内项目",
    period: "近期项目",
    role: "核心成员",
    details: [defaultResumeDraft.projectText],
    result: "",
  }],
  resumeMarkdown: "",
  updatedAt: "2026-09-06T00:00:00.000Z",
};

export function loadCareerProfile() {
  if (typeof window === "undefined") return null;
  const saved = window.localStorage.getItem(CAREER_PROFILE_STORAGE_KEY);
  if (!saved) return null;
  try {
    const parsed = CareerProfileSchema.safeParse(JSON.parse(saved));
    if (parsed.success) return parsed.data;
  } catch {
    // A malformed local draft should never prevent the workspace from opening.
  }
  window.localStorage.removeItem(CAREER_PROFILE_STORAGE_KEY);
  return null;
}

export function saveCareerProfile(profile: CareerProfile) {
  window.localStorage.setItem(CAREER_PROFILE_STORAGE_KEY, JSON.stringify(profile));
  window.dispatchEvent(new Event(CAREER_PROFILE_EVENT));
}

export function getCareerProfileSnapshot() {
  return typeof window === "undefined" ? null : window.localStorage.getItem(CAREER_PROFILE_STORAGE_KEY);
}

export function subscribeCareerProfile(onStoreChange: () => void) {
  function handleStorage(event: StorageEvent) {
    if (event.key === CAREER_PROFILE_STORAGE_KEY) onStoreChange();
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
