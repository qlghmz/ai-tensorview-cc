import { useEffect, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  projectId: string;
  initialName: string;
  initialDescription?: string | null;
  onClose: () => void;
  onSaved: (next: { name: string; description: string | null }) => void;
}

export function RenameProjectDialog({
  open,
  projectId,
  initialName,
  initialDescription,
  onClose,
  onSaved,
}: Props) {
  const [name, setName] = useState(initialName);
  const [desc, setDesc] = useState(initialDescription ?? "");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName(initialName);
      setDesc(initialDescription ?? "");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, initialName, initialDescription]);

  if (!open) return null;

  const save = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return toast.error("名称不能为空");
    if (trimmed.length > 80) return toast.error("名称最多 80 个字符");

    setBusy(true);
    const { error } = await supabase
      .from("projects")
      .update({
        name: trimmed,
        description: desc.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId);
    setBusy(false);

    if (error) {
      toast.error("保存失败：" + error.message);
      return;
    }
    toast.success("已更新");
    onSaved({ name: trimmed, description: desc.trim() || null });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-foreground/20 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <form
        onSubmit={save}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl bg-card border border-border shadow-[var(--shadow-card)] p-6"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-lg">重命名项目</h3>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <label className="mt-5 block text-xs font-medium text-muted-foreground">名称</label>
        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          className="mt-1.5 w-full rounded-xl bg-input border border-border px-3 py-2.5 text-sm outline-none focus:border-brand transition"
          placeholder="项目名称"
        />

        <label className="mt-4 block text-xs font-medium text-muted-foreground">描述（可选）</label>
        <textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          rows={3}
          className="mt-1.5 w-full rounded-xl bg-input border border-border px-3 py-2.5 text-sm outline-none focus:border-brand transition resize-none"
          placeholder="简单描述这个项目..."
        />

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm hover:bg-accent transition"
            disabled={busy}
          >
            取消
          </button>
          <button
            type="submit"
            disabled={busy || !name.trim()}
            className="rounded-xl btn-brand px-4 py-2 text-sm font-semibold disabled:opacity-50 flex items-center gap-2"
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            保存
          </button>
        </div>
      </form>
    </div>
  );
}
