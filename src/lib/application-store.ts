import { ApplicationListSchema, type ApplicationRecord } from "@/lib/schemas";

export const APPLICATION_STORAGE_KEY = "zhihang-applications";
export const APPLICATION_EVENT = "zhihang-applications-change";

export const DEFAULT_APPLICATIONS: ApplicationRecord[] = [
  {
    id: "sample-byte",
    company: "字节跳动",
    role: "AI 产品经理实习生",
    jobId: "byte",
    stage: "preparing",
    nextAction: "完成定向简历并核对投递材料",
    deadline: "",
    notes: "示例记录，可编辑或删除",
    updatedAt: "2026-09-06T00:00:00.000Z",
  },
  {
    id: "sample-tencent",
    company: "腾讯",
    role: "产品策划实习生",
    jobId: "tencent",
    stage: "interested",
    nextAction: "拆解 JD 并确认岗位匹配差距",
    deadline: "",
    notes: "示例记录，可编辑或删除",
    updatedAt: "2026-09-06T00:00:00.000Z",
  },
];

export function getApplicationsSnapshot() {
  return typeof window === "undefined" ? null : window.localStorage.getItem(APPLICATION_STORAGE_KEY);
}

export function parseApplicationsSnapshot(snapshot: string | null) {
  if (!snapshot) return DEFAULT_APPLICATIONS;
  try {
    const parsed = ApplicationListSchema.safeParse(JSON.parse(snapshot));
    return parsed.success ? parsed.data : DEFAULT_APPLICATIONS;
  } catch {
    return DEFAULT_APPLICATIONS;
  }
}

export function subscribeApplications(onStoreChange: () => void) {
  function handleStorage(event: StorageEvent) {
    if (event.key === APPLICATION_STORAGE_KEY) onStoreChange();
  }
  window.addEventListener("storage", handleStorage);
  window.addEventListener(APPLICATION_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(APPLICATION_EVENT, onStoreChange);
  };
}

export function saveApplications(applications: ApplicationRecord[]) {
  window.localStorage.setItem(APPLICATION_STORAGE_KEY, JSON.stringify(applications));
  window.dispatchEvent(new Event(APPLICATION_EVENT));
}
