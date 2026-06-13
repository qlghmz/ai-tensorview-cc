/**
 * 后端能力配方表：先 plan，再让客户选，再写代码。
 *
 * 这里只做「能力检测 + 方案描述」，不直接写代码。
 * 代码由模型在用户确认方案后才生成（见 ai-generate-shared.ts）。
 */

export interface BackendRecipe {
  /** 能力 id（写进 plan 消息里，便于回合识别） */
  id: string;
  /** 触发该能力的关键词 */
  keywords: RegExp;
  /** plan 标题 */
  title: string;
  /** 方案列表 */
  options: Array<{
    label: string;
    desc: string;
    /** 部署时需要客户提供的 env 变量名；空数组表示纯前端 Mock */
    envs: string[];
    /** 给模型的 prompt 片段（确认后注入到生成 prompt） */
    promptHint: string;
  }>;
}

export const BACKEND_RECIPES: BackendRecipe[] = [
  {
    id: "sms_otp",
    keywords: /(短信|验证码|手机号注册|手机号登录|OTP|SMS)/i,
    title: "短信验证码 / 手机号登录",
    options: [
      {
        label: "A. 演示模式（推荐，零成本）",
        desc: "前端生成一个 6 位验证码并直接弹窗显示给用户；不发真短信。适合 demo / 内测。",
        envs: [],
        promptHint:
          "短信验证码使用前端 Mock：点击「获取验证码」时随机生成 6 位数字并用 toast / alert 显示；输入相同数字即可通过验证。不要假装调用真实接口。",
      },
      {
        label: "B. 阿里云短信（真发短信）",
        desc: "在 /api/sms.ts 中调用阿里云短信网关，需要客户提供 4 个 Key。仅 Vercel 部署支持。",
        envs: ["ALI_SMS_ACCESS_KEY_ID", "ALI_SMS_ACCESS_KEY_SECRET", "ALI_SMS_SIGN_NAME", "ALI_SMS_TEMPLATE_CODE"],
        promptHint:
          "生成 /api/sms.ts（Web 标准 Request/Response），POST {phone} → 调用阿里云 dysmsapi 发送 4 位随机验证码；服务端把 code 写进一个 5 分钟过期的内存 Map（key=phone）。再生成 /api/sms-verify.ts POST {phone, code} → 校验并清除。前端 fetch 这两个接口。",
      },
    ],
  },
  {
    id: "email_auth",
    keywords: /(邮箱注册|邮箱登录|email\s*register|email\s*login|账号注册|账号登录|注册.*邮箱)/i,
    title: "邮箱注册 / 登录",
    options: [
      {
        label: "A. 演示模式（localStorage）",
        desc: "账号密码存浏览器本地；刷新仍在，但换设备/换浏览器就没了。适合演示。",
        envs: [],
        promptHint:
          "邮箱登录全部用 localStorage：注册写入 users 数组，登录比对；不要假装调用真实接口。",
      },
      {
        label: "B. 真实邮箱登录（Supabase 内置）",
        desc: "接入站点自带的 Supabase Auth，支持邮箱+密码+发激活信。需要在生成站独立开启 Cloud。",
        envs: ["SUPABASE_URL", "SUPABASE_ANON_KEY"],
        promptHint:
          "使用 @supabase/supabase-js 做注册/登录；env 走 import.meta.env.VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY。",
      },
    ],
  },
  {
    id: "form_submit",
    keywords: /(留言|反馈|联系我们|意见|表单提交|contact\s*form)/i,
    title: "表单 / 留言收集",
    options: [
      {
        label: "A. 演示模式",
        desc: "提交后只显示「已收到」，不存任何地方。",
        envs: [],
        promptHint: "表单提交只显示成功 toast，不调任何接口。",
      },
      {
        label: "B. 转发到 Webhook（飞书/Slack/Discord）",
        desc: "生成 /api/contact.ts，把表单内容 POST 到客户提供的 Webhook URL。",
        envs: ["CONTACT_WEBHOOK_URL"],
        promptHint:
          "生成 /api/contact.ts：POST 表单 → fetch(process.env.CONTACT_WEBHOOK_URL, {method:'POST', body: JSON})。",
      },
    ],
  },
  {
    id: "payment",
    keywords: /(支付|结账|下单|购物车|payment|checkout)/i,
    title: "支付 / 下单",
    options: [
      {
        label: "演示模式（唯一可选）",
        desc: "下单后只是跳到一个「支付成功」页；真实支付请上线后接 Stripe 或支付宝。",
        envs: [],
        promptHint: "支付流程只显示假的支付成功页面，不调任何接口。",
      },
    ],
  },
];

export interface DetectedPlan {
  needsBackend: boolean;
  recipes: BackendRecipe[];
}

/** 检测用户 prompt 是否需要后端能力 plan */
export function detectBackendNeeds(prompt: string): DetectedPlan {
  const recipes = BACKEND_RECIPES.filter((r) => r.keywords.test(prompt));
  return { needsBackend: recipes.length > 0, recipes };
}

/** 检查历史消息里是否已经确认过方案（用户回复包含 方案A/B / mock / 真实 / 演示 等） */
export function isPlanConfirmed(messages?: Array<{ role: string; content: string }>): boolean {
  if (!messages) return false;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "user") continue;
    if (/方案\s*[ABab]|演示模式|mock|真实后端|阿里云短信|webhook|localstorage|supabase/i.test(m.content)) {
      return true;
    }
  }
  return false;
}

/** 渲染 plan 卡片消息（assistant reply） */
export function renderPlanMessage(recipes: BackendRecipe[]): string {
  const lines: string[] = [
    "我注意到这个需求涉及**后端功能**。先给你几个方案选——回复「**方案 A**」「**方案 B**」即可继续生成。",
    "",
  ];
  recipes.forEach((r) => {
    lines.push(`### ${r.title}`);
    r.options.forEach((o) => {
      lines.push(`- **${o.label}** — ${o.desc}`);
      if (o.envs.length) {
        lines.push(`  - 需要的 Key：\`${o.envs.join("`, `")}\`（确认后我会在 chat 里向你索要）`);
      }
    });
    lines.push("");
  });
  lines.push("> 不确定就先选演示模式（A），随时可以再让我升级到真实后端。");
  return lines.join("\n");
}

/** 根据已确认方案，从最近一条 user 消息里提取选项（粗略） */
export function extractConfirmedOptions(
  recipes: BackendRecipe[],
  lastUserMsg: string,
): Array<{ recipeId: string; option: BackendRecipe["options"][number] }> {
  const out: Array<{ recipeId: string; option: BackendRecipe["options"][number] }> = [];
  const wantsRealAli = /阿里云|真实/i.test(lastUserMsg);
  const wantsRealEmail = /supabase|真实邮箱/i.test(lastUserMsg);
  const wantsWebhook = /webhook|飞书|slack|discord/i.test(lastUserMsg);
  const explicitB = /方案\s*B/i.test(lastUserMsg);
  const explicitA = /方案\s*A|mock|演示|localstorage/i.test(lastUserMsg);

  for (const r of recipes) {
    let opt = r.options[0]; // 默认 A
    if (r.id === "sms_otp" && (wantsRealAli || explicitB)) opt = r.options[1] ?? opt;
    else if (r.id === "email_auth" && (wantsRealEmail || explicitB)) opt = r.options[1] ?? opt;
    else if (r.id === "form_submit" && (wantsWebhook || explicitB)) opt = r.options[1] ?? opt;
    else if (explicitA) opt = r.options[0];
    out.push({ recipeId: r.id, option: opt });
  }
  return out;
}
