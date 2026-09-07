export type ResumeDraft = {
  name: string;
  education: string;
  targetRole: string;
  skills: string[];
  projectName: string;
  projectText: string;
};

export const defaultResumeDraft: ResumeDraft = {
  name: "李同学",
  education: "浙江大学 · 工业设计 · 2027 届",
  targetRole: "AI 产品经理 / 产品策划",
  skills: ["Figma", "Axure", "用户研究", "产品需求文档", "AI Agent", "Prompt Design", "Excel"],
  projectName: "大学生 AI 求职实训智能体空间",
  projectText: "负责大学生 AI 求职系统设计和开发，完成简历、岗位匹配等功能。",
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
