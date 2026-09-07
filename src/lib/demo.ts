import type { AgentName, ApplicationRecord, CareerProfile, JDAnalysis, MatchReport, OfferCandidate } from "@/lib/schemas";

const splitItems = (value: unknown) =>
  String(value || "")
    .split(/[、,，;；\n]/)
    .map((item) => item.trim())
    .filter(Boolean);

export function demoResult(agent: AgentName, input: unknown, context: unknown) {
  const data = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;

  if (agent === "resume") {
    const resumeText = String(data.resumeText || "").trim();
    if (resumeText) {
      const lines = resumeText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      const knownSkills = ["Figma", "Python", "SQL", "Excel", "数据分析", "用户研究", "产品设计", "AI Agent", "大模型", "PPT"];
      const skills = knownSkills.filter((skill) => resumeText.toLowerCase().includes(skill.toLowerCase()));
      const nameCandidate = lines.find((line) => /^[\u4e00-\u9fa5·]{2,8}$/.test(line)) || "";
      const targetRole = resumeText.match(/(?:求职意向|目标岗位|求职方向)[：:]?\s*([^\n]+)/)?.[1]?.trim() || "";
      const school = lines.find((line) => /大学|学院/.test(line)) || "";
      const projectLine = lines.find((line) => /项目|作品|竞赛/.test(line)) || "";
      return {
        basics: { name: nameCandidate, school, major: "", grade: "", targetRole, location: "" },
        skills,
        strengths: skills.slice(0, 3).map((skill) => `${skill} 相关经历待人工核对`),
        projects: projectLine ? [{ title: projectLine.slice(0, 60), organization: "", period: "", role: "", details: [], result: "" }] : [],
        resumeMarkdown: resumeText,
        updatedAt: new Date().toISOString(),
      };
    }
    const skills = splitItems(data.skills);
    const experience = String(data.experience || "").trim();
    const projectName = String(data.projectName || "代表性实践经历");
    const projectResult = String(data.projectResult || "").trim();
    const name = String(data.name || "同学");
    return {
      basics: {
        name: String(data.name || ""), school: String(data.school || ""), major: String(data.major || ""),
        grade: String(data.grade || ""), targetRole: String(data.targetRole || ""), location: String(data.location || ""),
      },
      skills,
      strengths: skills.slice(0, 3).map((skill) => `${skill} 基础与实践意识`),
      projects: experience ? [{
        title: projectName, organization: "个人 / 校内项目", period: "待补充", role: "项目成员",
        details: [experience], result: projectResult,
      }] : [],
      resumeMarkdown: `# ${name}\n\n**求职方向：** ${String(data.targetRole || "待明确")}\n\n## 教育背景\n${String(data.school || "待补充学校")} · ${String(data.major || "待补充专业")} · ${String(data.grade || "待补充年级")}\n\n## 核心技能\n${skills.length ? skills.map((s) => `- ${s}`).join("\n") : "- 待补充"}\n\n## 项目与实践\n${experience ? `- ${experience}` : "- 暂无；可从课程设计、竞赛、社团和个人作品中继续挖掘"}`,
      updatedAt: new Date().toISOString(),
    };
  }

  if (agent === "optimize") {
    const profile = data.profile as CareerProfile;
    const optimizationContext = (context && typeof context === "object" ? context : {}) as { jd?: JDAnalysis; match?: MatchReport };
    const sourceProject = profile.projects[0];
    const before = sourceProject ? [...sourceProject.details, sourceProject.result].filter(Boolean).join("；") : "";
    const after = sourceProject
      ? `${sourceProject.role ? `${sourceProject.role}：` : ""}${sourceProject.details.join("；")}${sourceProject.result ? `；项目结果：${sourceProject.result}` : ""}`
      : "";
    const sourceText = JSON.stringify(profile).toLowerCase();
    const usedKeywords = (optimizationContext.jd?.keywords || []).filter((keyword) => sourceText.includes(keyword.toLowerCase()));
    const optimizedProjects = sourceProject
      ? profile.projects.map((project, index) => index === 0 ? { ...project, details: [after], result: "" } : project)
      : profile.projects;
    const optimizedResumeMarkdown = `# ${profile.basics.name || "同学"}\n\n**求职方向：** ${profile.basics.targetRole || "待明确"}\n\n## 教育背景\n${[profile.basics.school, profile.basics.major, profile.basics.grade].filter(Boolean).join(" · ")}\n\n## 核心技能\n${profile.skills.map((skill) => `- ${skill}`).join("\n")}\n\n## 项目经历\n${optimizedProjects.map((project) => `### ${project.title}\n${project.details.map((detail) => `- ${detail}`).join("\n")}${project.result ? `\n- ${project.result}` : ""}`).join("\n\n")}`;
    const optimizedProfile = { ...profile, projects: optimizedProjects, resumeMarkdown: optimizedResumeMarkdown, updatedAt: new Date().toISOString() };
    return {
      optimizedProfile,
      optimizedResumeMarkdown,
      headline: sourceProject ? "重组项目表达，突出已有职责与成果" : "需要先补充项目经历",
      summary: sourceProject ? "演示引擎仅重排已有事实，没有新增数字或经历。" : "当前档案没有可优化的项目事实。",
      changes: sourceProject && before !== after ? [{
        section: "项目经历", before, after,
        reason: "把已有角色、行动与结果整理为更清晰的一段表达。",
        evidence: [sourceProject.role, ...sourceProject.details, sourceProject.result].filter(Boolean),
      }] : [],
      usedKeywords,
      unresolvedGaps: optimizationContext.match?.gaps || [],
      factWarnings: [],
      safeToApply: true,
    };
  }

  if (agent === "interview") {
    const interviewContext = (context && typeof context === "object" ? context : {}) as {
      profile?: CareerProfile;
      jd?: JDAnalysis;
      match?: MatchReport;
    };
    const profile = interviewContext.profile;
    const jd = interviewContext.jd;
    const match = interviewContext.match;
    const action = String(data.action || "prepare");

    if (action === "prepare") {
      const jobTitle = jd?.jobTitle || profile?.basics.targetRole || "目标岗位";
      const project = profile?.projects[0];
      const projectLabel = project?.title || "你最有代表性的项目";
      const strongestEvidence = [
        ...(profile?.skills || []).slice(0, 2),
        ...(project?.details || []).slice(0, 1),
      ];
      return {
        action: "prepare",
        sessionTitle: `${jobTitle} · 岗位模拟面试`,
        openingMessage: "本轮会从岗位动机、项目证据、能力差距和协作复盘四个角度训练。请只使用真实经历回答。",
        focusAreas: ["岗位动机", "项目深挖", ...(match?.gaps || ["能力证据"]).slice(0, 2)],
        questions: [
          {
            id: "q1",
            question: `为什么你想应聘${jobTitle}？请结合你的经历说明岗位契合点。`,
            intent: "判断求职动机是否具体，以及是否能把个人经历与岗位要求连接起来。",
            answerFramework: ["用一句话说明岗位吸引力", "引用一段真实经历证明契合", "说明希望解决的问题或成长方向"],
            keyPoints: strongestEvidence.length ? strongestEvidence : ["需要补充真实案例"],
          },
          {
            id: "q2",
            question: `请介绍${projectLabel}，重点说明你本人负责了什么、如何推进以及最终结果。`,
            intent: "验证项目所有权、行动细节和结果意识。",
            answerFramework: ["交代项目背景和目标", "说明个人职责与关键行动", "给出真实结果并复盘"],
            keyPoints: project ? [project.role, ...project.details, project.result].filter(Boolean) : ["需要补充真实案例"],
          },
          {
            id: "q3",
            question: `这个岗位看重${jd?.requiredSkills.slice(0, 2).join("、") || "岗位核心能力"}。你有哪些可以验证的相关证据？`,
            intent: "区分技能标签与实际使用证据。",
            answerFramework: ["选择一项最相关能力", "描述使用场景和具体动作", "说明输出物或可验证结果"],
            keyPoints: strongestEvidence.length ? strongestEvidence : ["需要补充真实案例"],
          },
          {
            id: "q4",
            question: `你的当前材料在“${match?.gaps[0] || "关键能力证据"}”方面还不充分。你会如何诚实回应并制定补足计划？`,
            intent: "观察候选人面对能力差距时的自我认知与行动规划。",
            answerFramework: ["承认当前边界", "说明可迁移的已有基础", "给出具体学习或实践计划"],
            keyPoints: [match?.gaps[0] || "需要补充真实案例"],
          },
          {
            id: "q5",
            question: "请讲一次你与他人协作遇到分歧或阻力的经历，你采取了什么行动？",
            intent: "评估沟通、协作和复盘能力。",
            answerFramework: ["说明分歧发生的背景", "突出你的沟通与推动动作", "交代结果和后续反思"],
            keyPoints: project ? [project.organization, project.role, ...project.details].filter(Boolean) : ["需要补充真实案例"],
          },
        ],
      };
    }

    const answer = String(data.answer || "").trim();
    const evidenceFound = answer
      .split(/[。！？；\n]/)
      .map((item) => item.trim())
      .filter((item) => item.length >= 8)
      .slice(0, 3);
    const hasAction = /负责|完成|设计|分析|推进|协调|访谈|搭建|优化|解决/.test(answer);
    const hasResult = /结果|最终|上线|交付|提升|降低|完成|获得|通过|反馈/.test(answer);
    const hasReflection = /复盘|反思|学到|改进|下一步/.test(answer);
    const score = Math.min(90, Math.max(30, 38 + (answer.length >= 80 ? 18 : answer.length >= 35 ? 10 : 0) + (hasAction ? 16 : 0) + (hasResult ? 12 : 0) + (hasReflection ? 6 : 0)));
    const strengths = [
      ...(hasAction ? ["回答包含了个人行动，能够区分团队工作与个人贡献。"] : []),
      ...(hasResult ? ["回答提到了结果或交付，具备一定结果意识。"] : []),
    ];
    const improvements = [
      ...(answer.length < 35 ? ["回答过短，需要补充背景、个人行动和结果。"] : []),
      ...(!hasAction ? ["补充你本人具体做了什么，避免只介绍团队或项目。"] : []),
      ...(!hasResult ? ["补充可验证的结果；没有数字时可以说明交付物、反馈或状态变化。"] : []),
      ...(!hasReflection ? ["用一句复盘说明你学到了什么，以及下次会如何改进。"] : []),
    ];
    return {
      action: "evaluate",
      evaluation: {
        score,
        summary: "这是演示引擎按回答完整度、个人行动、结果和复盘信号生成的训练反馈，不代表真实录用判断。",
        strengths: strengths.length ? strengths : ["已经开始正面回应问题，没有回避作答。"],
        improvements: improvements.length ? improvements : ["可以进一步压缩背景，把更多篇幅留给关键行动和结果。"],
        evidenceFound,
        betterAnswer: answer
          ? `可以按“背景—任务—个人行动—结果—复盘”重新组织你的原话：${answer}（请在缺少的位置补充真实信息，不要编造数字。）`
          : "请先输入真实回答，再按“背景—任务—个人行动—结果—复盘”组织内容。",
        followUpQuestion: hasResult ? "这个结果中，哪一部分最能证明是由你的行动推动的？" : "这段经历最后产生了什么可验证的交付物或反馈？",
      },
    };
  }

  if (agent === "career") {
    const profile = data.profile as CareerProfile;
    const primaryRole = profile.basics.targetRole || "AI 产品实习生";
    const evidence = [
      ...profile.skills.slice(0, 2),
      ...profile.projects.flatMap((project) => [project.title, ...project.details]).slice(0, 2),
    ].filter(Boolean);
    const hasProjects = profile.projects.length > 0;
    return {
      summary: hasProjects
        ? "当前档案已经形成初步方向，适合先用相邻岗位的小型任务验证兴趣与能力，再决定是否进一步收窄。"
        : "当前档案证据较少，以下方向只适合作为探索假设，需要先补充课程、项目或实践信息。",
      recommendedRoles: [
        {
          role: primaryRole,
          fitScore: hasProjects ? 74 : 48,
          fitReason: "与当前求职目标及已记录技能最接近。",
          evidence,
          risks: hasProjects ? ["成果指标和岗位技能证据仍可加强"] : ["缺少可验证的项目经历"],
          nextExperiment: "选择一个真实 JD，完成一次需求拆解或产品分析作品。",
        },
        {
          role: "产品运营实习生",
          fitScore: hasProjects ? 66 : 43,
          fitReason: "可迁移项目协作、内容表达和 AI 工具使用经验。",
          evidence: evidence.slice(0, 2),
          risks: ["运营数据与增长案例尚不充分"],
          nextExperiment: "为一个校园项目设计一周运营实验并记录结果。",
        },
      ],
      recommendedIndustries: ["互联网产品", "AI 应用", "教育科技"],
      positioningStatement: `${profile.basics.major || "在校"}背景、具备${profile.skills.slice(0, 3).join("、") || "项目实践"}基础，正在通过真实项目验证${primaryRole}方向。`,
      questionsToConfirm: ["你最愿意长期投入解决哪类用户问题？", "你更享受分析设计、推动协作还是运营增长？"],
    };
  }

  if (agent === "gap") {
    const profile = data.profile as CareerProfile;
    const gapContext = (context && typeof context === "object" ? context : {}) as { career?: { recommendedRoles?: Array<{ role?: string }> } };
    const targetRole = gapContext.career?.recommendedRoles?.[0]?.role || profile.basics.targetRole || "目标岗位";
    const skillEvidence = profile.skills.slice(0, 3);
    const projectEvidence = profile.projects.flatMap((project) => [project.title, ...project.details]).filter(Boolean).slice(0, 3);
    const evidenceCount = skillEvidence.length + projectEvidence.length;
    return {
      readinessScore: Math.min(82, 38 + evidenceCount * 6),
      summary: `当前对${targetRole}已有可迁移基础，但技能标签、项目行动与可验证结果之间仍需建立更完整的证据链。`,
      strengths: [
        { skill: "岗位相关基础", evidence: skillEvidence },
        { skill: "项目实践", evidence: projectEvidence },
      ].filter((item) => item.evidence.length),
      gaps: [
        { skill: "数据化复盘", priority: "high", reason: "多数产品与运营岗位要求用数据验证判断。", currentEvidence: [], nextProof: "选择一个现有项目，补充目标、观察指标和一次真实复盘。" },
        { skill: "岗位作品证据", priority: "high", reason: "作品比单独罗列技能更容易验证能力。", currentEvidence: projectEvidence.slice(0, 1), nextProof: `围绕${targetRole}完成一份需求分析或案例拆解。` },
        { skill: "结构化表达", priority: "medium", reason: "简历和面试都需要清楚说明个人行动与结果。", currentEvidence: projectEvidence.slice(1, 2), nextProof: "把一段项目经历整理为 2 分钟 STAR 介绍并录音复盘。" },
      ],
      priorityOrder: ["岗位作品证据", "数据化复盘", "结构化表达"],
    };
  }

  if (agent === "plan") {
    const profile = data.profile as CareerProfile;
    const planContext = (context && typeof context === "object" ? context : {}) as { gap?: { gaps?: Array<{ skill?: string; nextProof?: string }> } };
    const gaps = planContext.gap?.gaps || [];
    const focus = (index: number, fallback: string) => gaps[index]?.skill || fallback;
    const proof = (index: number, fallback: string) => gaps[index]?.nextProof || fallback;
    return {
      title: `${profile.basics.targetRole || "目标岗位"} · 4 周证据提升计划`,
      durationWeeks: 4,
      objective: "用低成本真实任务补齐最关键的岗位证据，并同步沉淀到简历和面试表达中。",
      weeklyPlan: [
        { week: 1, focus: focus(0, "岗位作品"), tasks: ["拆解 3 个同类岗位 JD", "确定一个可在一周完成的小作品"], deliverable: proof(0, "一页岗位需求清单和作品题目"), successCheck: "能明确说出作品对应的 3 项岗位要求" },
        { week: 2, focus: "完成核心作品", tasks: ["完成关键调研或数据整理", "制作可演示的最小成果"], deliverable: "一份可以打开查看的作品初稿", successCheck: "作品包含问题、过程、个人行动和当前结果" },
        { week: 3, focus: focus(1, "数据化复盘"), tasks: ["邀请 3 位同学体验并记录反馈", "根据反馈完成一次迭代"], deliverable: proof(1, "真实反馈记录与迭代对照"), successCheck: "每项改动都能追溯到一条真实反馈" },
        { week: 4, focus: focus(2, "求职表达"), tasks: ["更新 Career Profile 和简历", "完成 2 次岗位模拟面试"], deliverable: proof(2, "定向简历与 2 分钟项目介绍"), successCheck: "表达中包含背景、个人行动、结果和复盘" },
      ],
      maintenanceRules: ["每周只保留一个核心交付物", "没有真实数据时明确说明，不补造数字", "每次完成作品后同步更新 Career Profile"],
    };
  }

  if (agent === "application") {
    const applications = Array.isArray(data.applications) ? data.applications as ApplicationRecord[] : [];
    const active = applications.filter((item) => item.stage !== "closed");
    const priorities = active.slice(0, 4).map((item) => {
      const action = item.nextAction || (item.stage === "interested" ? "确认岗位要求并准备定向简历" : item.stage === "applied" ? "记录投递日期并准备跟进" : item.stage === "interview" ? "完成岗位模拟面试与问题清单" : item.stage === "offer" ? "核验 Offer 条款并整理决策信息" : "补充明确的下一步行动");
      return {
        applicationId: item.id,
        action,
        reason: item.deadline ? `记录中存在截止信息：${item.deadline}` : `当前处于“${item.stage}”阶段，需要明确下一步。`,
        urgency: item.deadline ? "today" : item.stage === "interview" || item.stage === "offer" ? "this_week" : "later",
      };
    });
    const completeActions = active.filter((item) => item.nextAction.trim()).length;
    return {
      summary: active.length ? `当前有 ${active.length} 条进行中的求职记录，建议先处理有截止信息和已进入面试阶段的机会。` : "当前没有进行中的投递记录，先添加感兴趣的岗位并记录下一步。",
      pipelineHealth: active.length ? Math.min(90, 42 + Math.round((completeActions / active.length) * 38)) : 25,
      priorities,
      followUps: active.filter((item) => item.stage === "applied").map((item) => `核对 ${item.company} · ${item.role} 的投递时间和可用跟进渠道。`),
      risks: [
        ...(active.some((item) => !item.nextAction.trim()) ? ["部分记录缺少下一步行动。"] : []),
        ...(active.some((item) => !item.deadline.trim()) ? ["部分记录未填写截止或跟进日期，请仅在确认后补充。"] : []),
      ],
    };
  }

  if (agent === "offer") {
    const offers = Array.isArray(data.offers) ? data.offers as OfferCandidate[] : [];
    const annualCash = (offer: OfferCandidate) => offer.monthlySalary * offer.salaryMonths + offer.bonus;
    const sorted = offers.toSorted((left, right) => annualCash(right) - annualCash(left));
    return {
      ranking: sorted.map((offer, index) => ({
        offerId: offer.id,
        score: Math.max(50, 86 - index * 8),
        reasons: [
          annualCash(offer) > 0 ? `按已填数字估算，年度现金合计约 ${annualCash(offer).toLocaleString("zh-CN")} 元。` : "尚未填写可比较的薪酬数字。",
          offer.growth ? `成长信息：${offer.growth}` : "成长路径尚待确认。",
        ],
        risks: [
          ...(!offer.workLife ? ["工作节奏信息未知"] : []),
          ...(!offer.notes ? ["福利、试用期和违约条款尚待核验"] : []),
        ],
      })),
      recommendation: sorted.length >= 2 ? `仅按当前已填信息，${sorted[0].company} · ${sorted[0].role} 的现金信息更占优；仍需结合成长、工作节奏和个人偏好决定。` : "至少添加两份真实 Offer 才能形成有意义的比较。",
      tradeoffs: ["更高的短期现金收入不等于更合适的长期成长", "城市成本、团队方向和工作节奏需要与个人偏好一起比较"],
      questionsToVerify: ["薪资是否为税前，实际发放月数是多少？", "奖金的发放条件与历史兑现情况是什么？", "试用期、加班、竞业与违约条款是否清楚？"],
      negotiationPoints: ["确认职级、汇报关系和试用期标准", "基于其他机会与岗位价值讨论薪酬或入职时间"],
      disclaimer: "这是基于用户输入信息的演示性比较，不构成法律、财务或职业决策建议；请核对书面 Offer 与合同。",
    };
  }

  if (agent === "jd") {
    const text = String(input || "");
    const known = ["Python", "SQL", "Excel", "Figma", "数据分析", "产品", "AI", "大模型", "沟通", "PPT"];
    const keywords = known.filter((word) => text.toLowerCase().includes(word.toLowerCase()));
    return {
      jobTitle: text.match(/(?:岗位|职位)[：:]?\s*([^\n，。]+)/)?.[1]?.trim() || "待确认岗位",
      company: text.match(/(?:公司|企业)[：:]?\s*([^\n，。]+)/)?.[1]?.trim() || "未注明",
      summary: "该岗位重视基础能力、项目实践与跨团队协作，建议结合完整 JD 进一步核验。",
      responsibilities: ["完成岗位相关的日常任务与项目支持", "与团队协作并沉淀工作成果"],
      requiredSkills: keywords.length ? keywords : ["岗位相关基础能力", "沟通协作"],
      preferredSkills: ["相关项目或实习经历", "主动学习与复盘能力"],
      keywords: keywords.length ? keywords : ["项目实践", "协作", "学习能力"],
      experienceLevel: /实习|应届|校招/.test(text) ? "在校生 / 应届生" : "未注明",
      education: /本科/.test(text) ? "本科" : "未注明",
    };
  }

  const matchContext = (context && typeof context === "object" ? context : {}) as { profile?: CareerProfile; jd?: JDAnalysis };
  const profile = matchContext.profile;
  const jd = matchContext.jd;
  const profileSkills = profile?.skills || [];
  const requirements = jd?.requiredSkills || [];
  const matched = requirements.filter((requirement) =>
    profileSkills.some((skill) => requirement.toLowerCase().includes(skill.toLowerCase()) || skill.toLowerCase().includes(requirement.toLowerCase())),
  );
  const gaps = requirements.filter((item) => !matched.includes(item));
  const score = requirements.length ? Math.round(35 + (matched.length / requirements.length) * 55) : 45;
  const skillCoverage = requirements.length ? matched.length / requirements.length : 0.35;
  const projectCount = profile?.projects.length || 0;
  const detailCount = profile?.projects.reduce((total, project) => total + project.details.length, 0) || 0;
  return {
    score,
    dimensions: {
      skills: Math.round(35 + skillCoverage * 55),
      projects: Math.min(90, 35 + projectCount * 25),
      education: profile?.basics.school || profile?.basics.major ? 72 : 35,
      experience: Math.min(90, 35 + detailCount * 18),
    },
    verdict: score >= 70 ? "具备较好基础，可针对性优化后投递" : "有一定迁移基础，建议先补齐关键证据",
    matchedSkills: matched,
    gaps: gaps.length ? gaps : ["岗位成果的量化证据仍可加强"],
    evidence: profileSkills.slice(0, 3).map((skill) => `档案中已记录 ${skill}`),
    actionPlan: ["优先补充一个与岗位要求直接相关的作品或项目", "用 STAR 结构重写最相关经历", "准备 2 分钟项目介绍并进行模拟问答"],
    resumeTips: ["把最匹配的技能前置", "每段项目经历补充个人动作与可验证结果"],
  };
}
