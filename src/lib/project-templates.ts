export type ProjectTemplate = {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  descriptionEn: string;
  emoji: string;
  prompt: string;
  styleId: string;
};

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: "saas-landing",
    name: "SaaS 落地页",
    nameEn: "SaaS landing",
    description: "Hero + 功能 + 定价 + FAQ",
    descriptionEn: "Hero, features, pricing, FAQ",
    emoji: "🚀",
    styleId: "minimal-saas",
    prompt:
      "做一个 B2B SaaS 落地页：Hero 区有标题、副标题和主 CTA；3 个核心功能卡片；两档定价；5 条 FAQ。",
  },
  {
    id: "portfolio",
    name: "作品集",
    nameEn: "Portfolio",
    description: "个人品牌展示",
    descriptionEn: "Personal brand showcase",
    emoji: "💼",
    styleId: "dark-dev",
    prompt: "做一个开发者作品集：关于我、项目展示网格（6 个项目卡片）、技能标签、联系方式。",
  },
  {
    id: "coffee-shop",
    name: "咖啡品牌",
    nameEn: "Coffee brand",
    description: "电商首页",
    descriptionEn: "E-commerce homepage",
    emoji: "☕",
    styleId: "warm-commerce",
    prompt: "做一个精品咖啡品牌首页：大图 Hero、招牌产品、产地故事、订阅 CTA。",
  },
  {
    id: "ai-product",
    name: "AI 产品官网",
    nameEn: "AI product site",
    description: "对话类产品介绍",
    descriptionEn: "AI chat product marketing",
    emoji: "🤖",
    styleId: "minimal-saas",
    prompt: "做一个 AI 对话产品官网：产品演示区、使用场景、对比表格、免费试用按钮。",
  },
  {
    id: "startup",
    name: "创业团队",
    nameEn: "Startup team",
    description: "公司介绍 + 招聘",
    descriptionEn: "Company + careers",
    emoji: "🏢",
    styleId: "corporate",
    prompt: "做一个创业团队官网：使命愿景、团队成员、开放职位列表、联系表单区块。",
  },
  {
    id: "event",
    name: "活动报名",
    nameEn: "Event registration",
    description: "峰会 / 工作坊",
    descriptionEn: "Conference / workshop",
    emoji: "🎫",
    styleId: "playful",
    prompt: "做一个技术峰会活动页：议程时间表、嘉宾介绍、报名 CTA、地点与日期信息。",
  },
];
