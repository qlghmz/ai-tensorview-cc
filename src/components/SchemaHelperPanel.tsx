import { Database } from "lucide-react";
import { BACKEND_RECIPES } from "@/lib/backend-recipes";

interface Props {
  prompt: string;
  open: boolean;
  onClose: () => void;
}

export function SchemaHelperPanel({ prompt, open, onClose }: Props) {
  if (!open) return null;

  const matched = BACKEND_RECIPES.filter((r) => r.keywords.test(prompt));

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-2xl border border-border bg-card p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-3">
          <Database className="h-5 w-5 text-brand" />
          <h2 className="font-semibold">Supabase 表结构建议</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          根据你的需求检测到的后端能力。在 Supabase SQL Editor 中执行对应 DDL，或在对话中确认方案后让 AI 生成接入代码。
        </p>

        {matched.length === 0 ? (
          <p className="text-sm text-muted-foreground">当前 prompt 未检测到需要数据库的后端能力。如需表单/登录，在对话里说明即可。</p>
        ) : (
          <div className="space-y-4">
            {matched.map((recipe) => (
              <div key={recipe.id} className="rounded-xl border border-border/50 p-3">
                <div className="font-medium text-sm mb-2">{recipe.title}</div>
                {recipe.options.map((opt, i) => (
                  <div key={i} className="mb-3 last:mb-0">
                    <div className="text-xs font-medium text-brand">{opt.label}</div>
                    <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                    {opt.envs.length > 0 && (
                      <p className="text-[10px] font-mono mt-1 text-muted-foreground">Env: {opt.envs.join(", ")}</p>
                    )}
                    {recipe.id === "email_auth" && (
                      <pre className="mt-2 text-[10px] bg-muted/40 p-2 rounded-lg overflow-x-auto">{`-- profiles 扩展示例
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz default now()
);
alter table public.profiles enable row level security;`}</pre>
                    )}
                    {recipe.id === "sms_otp" && (
                      <pre className="mt-2 text-[10px] bg-muted/40 p-2 rounded-lg overflow-x-auto">{`-- OTP 记录（生产环境请设 TTL + RLS）
create table if not exists public.phone_otps (
  phone text primary key,
  code text not null,
  expires_at timestamptz not null
);`}</pre>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        <button type="button" onClick={onClose} className="mt-4 w-full rounded-full glass py-2 text-sm">
          关闭
        </button>
      </div>
    </div>
  );
}
