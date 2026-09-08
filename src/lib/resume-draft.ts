export type ResumeDraft = {
  name: string;
  education: string;
  targetRole: string;
  skills: string[];
  projectName: string;
  projectText: string;
};

export const defaultResumeDraft: ResumeDraft = {
  name: "同学",
  education: "教育信息待补充",
  targetRole: "求职方向待明确",
  skills: [],
  projectName: "项目经历待补充",
  projectText: "暂未添加项目经历，可通过对话生成器或导入简历补充。",
};

export function createResumeDraft(answers: string[]): ResumeDraft {
  const [name, education, targetRole, skills, projectName, projectResult] = answers;
  return {
    name,
    education,
    targetRole,
    skills: skills.split(/[、,，/；;]/).map((item) => item.trim()).filter(Boolean),
    projectName,
    projectText: `在「${projectName}」项目中，${projectResult.replace(/[。！!]?$/, "")}。`,
  };
}
