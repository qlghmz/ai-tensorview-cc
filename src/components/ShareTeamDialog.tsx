import { useEffect, useState } from "react";
import { Copy, Link2, Loader2, Trash2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import {
  createProjectShareLink,
  inviteProjectMember,
  listProjectMembers,
  listProjectShareLinks,
  removeProjectMember,
  revokeProjectShareLink,
} from "@/lib/share.functions";

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: string;
}

export function ShareTeamDialog({ open, onClose, projectId }: Props) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [links, setLinks] = useState<Array<{ id: string; token: string; role: string; created_at: string }>>([]);
  const [members, setMembers] = useState<Array<{ user_id: string; role: string }>>([]);
  const [email, setEmail] = useState("");
  const [memberRole, setMemberRole] = useState<"viewer" | "editor">("viewer");

  const load = async () => {
    setLoading(true);
    try {
      const [l, m] = await Promise.all([
        listProjectShareLinks({ data: { projectId } }),
        listProjectMembers({ data: { projectId } }),
      ]);
      setLinks(l.items as typeof links);
      setMembers(m.items as typeof members);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) void load();
  }, [open, projectId]);

  const createLink = async (role: "view" | "edit") => {
    setBusy(true);
    try {
      const r = await createProjectShareLink({ data: { projectId, role } });
      const full = `${window.location.origin}${r.url}`;
      await navigator.clipboard.writeText(full);
      toast.success("分享链接已复制");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "创建失败");
    } finally {
      setBusy(false);
    }
  };

  const invite = async () => {
    if (!email.trim()) return;
    setBusy(true);
    try {
      await inviteProjectMember({ data: { projectId, email: email.trim(), role: memberRole } });
      toast.success("已邀请");
      setEmail("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "邀请失败");
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-card border border-border p-5 shadow-[var(--shadow-card)]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-4">
          <Users className="h-4 w-4 text-brand" />
          <h3 className="text-sm font-semibold">团队协作 & 分享</h3>
        </div>

        {loading ? (
          <div className="py-8 grid place-items-center">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <div className="space-y-5">
            <section>
              <div className="text-xs font-medium mb-2">只读 / 可编辑链接</div>
              <div className="flex gap-2">
                <button type="button" disabled={busy} onClick={() => createLink("view")} className="flex-1 rounded-full glass px-3 py-2 text-xs">
                  <Link2 className="h-3 w-3 inline mr-1" /> 只读链接
                </button>
                <button type="button" disabled={busy} onClick={() => createLink("edit")} className="flex-1 rounded-full btn-brand px-3 py-2 text-xs">
                  可编辑链接
                </button>
              </div>
              {links.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {links.map((l) => (
                    <li key={l.id} className="flex items-center gap-2 text-[11px] bg-muted/30 rounded-lg px-2 py-1.5">
                      <span className="flex-1 truncate font-mono">{l.role} · {l.token.slice(0, 8)}…</span>
                      <button
                        type="button"
                        onClick={() => {
                          void navigator.clipboard.writeText(`${window.location.origin}/share/${l.token}`);
                          toast.success("已复制");
                        }}
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                      <button type="button" disabled={busy} onClick={async () => { await revokeProjectShareLink({ data: { id: l.id } }); await load(); }}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <div className="text-xs font-medium mb-2 flex items-center gap-1">
                <UserPlus className="h-3 w-3" /> 邀请成员（邮箱）
              </div>
              <div className="flex gap-2">
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="flex-1 rounded-lg bg-input border border-border px-2 py-1.5 text-xs"
                />
                <select value={memberRole} onChange={(e) => setMemberRole(e.target.value as "viewer" | "editor")} className="rounded-lg bg-input border border-border text-xs px-2">
                  <option value="viewer">只读</option>
                  <option value="editor">编辑</option>
                </select>
                <button type="button" disabled={busy} onClick={invite} className="rounded-full btn-brand px-3 text-xs">
                  邀请
                </button>
              </div>
              {members.length > 0 && (
                <ul className="mt-2 text-[11px] text-muted-foreground space-y-1">
                  {members.map((m) => (
                    <li key={m.user_id} className="flex justify-between items-center">
                      <span>{m.user_id.slice(0, 8)}… · {m.role}</span>
                      <button type="button" disabled={busy} onClick={async () => { await removeProjectMember({ data: { projectId, userId: m.user_id } }); await load(); }}>
                        移除
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}

        <button type="button" onClick={onClose} className="mt-4 w-full rounded-full glass py-2 text-xs">
          关闭
        </button>
      </div>
    </div>
  );
}
