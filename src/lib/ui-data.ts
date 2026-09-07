export type Job = {
  id: string;
  company: string;
  role: string;
  location: string;
  salary: string;
  match: number;
  initials: string;
  posted: string;
  tags: string[];
  summary: string;
  responsibilities: string[];
  requirements: string[];
  scores: { label: string; value: number }[];
  strengths: string[];
  gaps: string[];
};

export const jobs: Job[] = [
  {
    id: "byte", company: "字节跳动", role: "AI 产品经理实习生", location: "上海 · 可转正", salary: "300–400/天", match: 87, initials: "字", posted: "今天更新", tags: ["大模型", "产品设计", "数据分析"],
    summary: "参与大模型产品的需求分析、功能设计与效果评估，协同算法和研发团队推进产品迭代。",
    responsibilities: ["洞察高校及青年用户的 AI 使用场景，输出需求文档与原型", "参与 Prompt 策略、模型效果与产品数据的评估", "跟踪项目进度，协同设计、算法与研发完成迭代"],
    requirements: ["2027 届本科及以上在校生", "有 AI 产品或完整项目实践，逻辑与表达能力强", "熟悉 Figma、SQL 或数据分析工具者优先"],
    scores: [{ label: "技能", value: 92 }, { label: "项目", value: 88 }, { label: "专业", value: 72 }, { label: "经历", value: 81 }],
    strengths: ["有大模型 API 与智能体项目实践", "具备从调研到原型的完整产品设计经历", "目标岗位与项目叙事高度一致"], gaps: ["SQL 能力尚未在简历中体现", "缺少产品效果指标与用户增长数据"],
  },
  {
    id: "tencent", company: "腾讯", role: "产品策划实习生", location: "深圳 · 暑期实习", salary: "250–350/天", match: 84, initials: "腾", posted: "1 天前", tags: ["用户研究", "竞品分析", "产品策划"],
    summary: "围绕内容与社交产品参与用户洞察、需求策划、版本跟进与上线复盘。", responsibilities: ["协助完成用户访谈、竞品研究与需求归纳", "撰写产品方案并推进版本协作", "关注核心数据并进行上线效果复盘"], requirements: ["2027 届本科及以上在校生", "热爱互联网产品，有优秀的产品感", "沟通推动能力强，有校园项目经验优先"],
    scores: [{ label: "技能", value: 86 }, { label: "项目", value: 84 }, { label: "专业", value: 75 }, { label: "经历", value: 80 }], strengths: ["有用户流程与产品原型经验", "校园项目与目标用户群体贴合", "表达和方案输出能力较强"], gaps: ["缺少正式用户访谈样本", "上线复盘与数据指标描述不足"],
  },
  {
    id: "ali", company: "阿里巴巴", role: "产品运营实习生", location: "杭州 · 线下", salary: "250–300/天", match: 81, initials: "阿", posted: "2 天前", tags: ["策略运营", "数据复盘", "AI 应用"],
    summary: "协助 AI 应用的用户运营、内容策略与活动落地，通过数据复盘持续优化运营效率。", responsibilities: ["策划用户活动与内容机制", "跟踪核心数据并沉淀运营复盘", "协作产品团队优化 AI 应用体验"], requirements: ["本科及以上在校生，可连续实习 3 个月", "具备内容或社群运营实践", "数据敏感，有 AI 工具使用经验"],
    scores: [{ label: "技能", value: 82 }, { label: "项目", value: 86 }, { label: "专业", value: 70 }, { label: "经历", value: 78 }], strengths: ["熟悉 AI 工具与目标用户场景", "有项目统筹和内容表达经验", "可将产品经验迁移至运营场景"], gaps: ["运营增长案例较少", "需要补充 Excel 数据分析证据"],
  },
];
