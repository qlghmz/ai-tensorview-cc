import { useState } from "react";
import { MessageCircle, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export function FeedbackButton() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!message.trim()) {
      toast.error("请填写问题描述");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.from("feedback").insert({
        user_id: user?.id ?? null,
        email: user?.email ?? email.trim() ?? null,
        subject: subject.trim() || null,
        message: message.trim(),
        url: typeof window !== "undefined" ? window.location.href : null,
      });
      if (error) throw error;
      toast.success("已收到，我们工作日 24 小时内回复 ✨");
      setOpen(false);
      setSubject("");
      setMessage("");
      setEmail("");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full btn-brand px-4 py-2.5 text-sm font-semibold shadow-lg hover:scale-105 transition"
        title="问题反馈"
      >
        <MessageCircle className="h-4 w-4" />
        <span className="hidden sm:inline">反馈</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>问题反馈</DialogTitle>
            <DialogDescription>
              告诉我们哪里有问题或想要什么功能，工作日 24 小时内回复。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {!user && (
              <Input
                type="email"
                placeholder="你的邮箱（方便我们回复）"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            )}
            <Input
              placeholder="主题（可选）"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
            <Textarea
              placeholder="详细描述..."
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <div className="text-xs text-muted-foreground">
              紧急问题可直接发邮件至
              <a className="text-brand mx-1" href="mailto:support@tensorview.cc">
                support@tensorview.cc
              </a>
            </div>
            <Button onClick={submit} disabled={busy} className="w-full">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "提交"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
