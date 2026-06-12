import { useEffect, useState } from "react";
import {
  Loader2,
  ExternalLink,
  Check,
  Copy,
  KeyRound,
  Rocket,
  Cloud,
} from "lucide-react";
import { toast } from "sonner";
import { useT } from "@/lib/i18n";
import { buildPublishedHtml } from "@/lib/publish-snapshot";
import { extractApiFiles } from "@/lib/deploy-bundle";
import {
  deleteVercelToken,
  getVercelTokenStatus,
  publishToVercel,
  saveVercelToken,
} from "@/lib/vercel-deploy.functions";
import type { LovableBundle } from "@/lib/lovable-bundle";

interface Props {
  projectId: string;
  projectName: string;
  bundle: LovableBundle | null;
  initialUrl?: string | null;
  onDeployed?: (url: string) => void;
}

export function VercelDeployPanel({
  projectId,
  projectName,
  bundle,
  initialUrl,
  onDeployed,
}: Props) {
  const t = useT();
  const [loading, setLoading] = useState(true);
  const [hasToken, setHasToken] = useState(false);
  const [tail, setTail] = useState<string | null>(null);
  const [tokenInput, setTokenInput] = useState("");
  const [editing, setEditing] = useState(false);
  const [savingToken, setSavingToken] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [url, setUrl] = useState<string | null>(initialUrl ?? null);
  const [copied, setCopied] = useState(false);

  const apiFiles = extractApiFiles(bundle);
  const apiCount = apiFiles ? Object.keys(apiFiles).length : 0;

  useEffect(() => {
    (async () => {
      try {
        const s = await getVercelTokenStatus();
        if (s.hasToken) {
          setHasToken(true);
          setTail(s.tail);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSaveToken = async () => {
    const token = tokenInput.trim();
    if (token.length < 10) {
      toast.error(t("publish.vercel.tokenPlaceholder"));
      return;
    }
    setSavingToken(true);
    try {
      const res = await saveVercelToken({ data: { token } });
      setHasToken(true);
      setTail(res.tail);
      setTokenInput("");
      setEditing(false);
      toast.success(t("publish.vercel.saved", { tail: res.tail }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "save failed");
    } finally {
      setSavingToken(false);
    }
  };

  const handleRemoveToken = async () => {
    try {
      await deleteVercelToken();
      setHasToken(false);
      setTail(null);
      setEditing(true);
      toast.success(t("publish.vercel.removed"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "failed");
    }
  };

  const handleDeploy = async () => {
    if (!bundle) {
      toast.error(t("publish.edgeone.noBundle"));
      return;
    }
    if (!hasToken) {
      toast.error(t("publish.vercel.noToken"));
      return;
    }
    setDeploying(true);
    try {
      const html = await buildPublishedHtml(bundle, { title: projectName });
      const res = await publishToVercel({
        data: { projectId, html, apiFiles },
      });
      setUrl(res.url);
      onDeployed?.(res.url);
      toast.success(t("publish.vercel.successToast"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "deploy failed");
    } finally {
      setDeploying(false);
    }
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error(t("publish.copyFailed"));
    }
  };

  const showInput = !hasToken || editing;

  return (
    <div className="space-y-3">
      <div className="text-[11px] text-muted-foreground leading-relaxed">
        {t("publish.vercel.intro")}
      </div>

      {showInput ? (
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground flex items-center gap-1">
            <KeyRound className="h-3 w-3 text-brand" />
            {t("publish.vercel.tokenLabel")}
          </label>
          <input
            type="password"
            autoComplete="off"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder={t("publish.vercel.tokenPlaceholder")}
            className="w-full rounded-lg bg-muted/30 px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-brand"
          />
          <div className="flex items-center justify-between gap-2">
            <a
              href="https://vercel.com/account/tokens?name=TensorView&expiration=never"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-brand hover:underline"
            >
              {t("publish.vercel.getToken")}
              <ExternalLink className="h-3 w-3" />
            </a>
            <button
              type="button"
              onClick={handleSaveToken}
              disabled={savingToken || tokenInput.trim().length < 10}
              className="rounded-lg btn-brand px-3 py-1.5 text-xs disabled:opacity-40 inline-flex items-center gap-1"
            >
              {savingToken ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <KeyRound className="h-3 w-3" />
              )}
              {savingToken ? t("publish.vercel.saving") : t("publish.vercel.saveToken")}
            </button>
          </div>
          <div className="text-[10px] text-muted-foreground">
            {t("publish.vercel.tokenHelp")}
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2 text-xs">
          <span className="inline-flex items-center gap-1">
            <KeyRound className="h-3 w-3 text-brand" />
            {t("publish.vercel.saved", { tail: tail ?? "----" })}
          </span>
          <button
            type="button"
            onClick={handleRemoveToken}
            className="text-[11px] text-muted-foreground hover:text-foreground underline"
          >
            {t("publish.vercel.replace")}
          </button>
        </div>
      )}

      {apiCount > 0 && (
        <div className="rounded-lg bg-brand/10 px-3 py-2 text-[11px] text-brand">
          {t("publish.vercel.apiHint", { n: apiCount })}
        </div>
      )}

      <button
        type="button"
        onClick={handleDeploy}
        disabled={deploying || loading || !hasToken || !bundle}
        className="w-full rounded-lg btn-brand py-2.5 text-sm font-medium disabled:opacity-40 flex items-center justify-center gap-2"
      >
        {deploying ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Rocket className="h-4 w-4" />
        )}
        {deploying
          ? t("publish.vercel.deploying")
          : url
            ? t("publish.vercel.redeploy")
            : t("publish.vercel.deploy")}
      </button>

      {url && (
        <div>
          <label className="text-xs text-muted-foreground flex items-center gap-1">
            <Cloud className="h-3 w-3 text-brand" />
            {t("publish.vercel.urlLabel")}
          </label>
          <div className="mt-1 flex items-center gap-1 rounded-lg bg-muted/30 px-2 py-1.5">
            <input
              readOnly
              value={url}
              className="flex-1 min-w-0 bg-transparent text-xs outline-none truncate"
            />
            <button
              type="button"
              onClick={() => copy(url)}
              className="rounded-md btn-brand p-1 shrink-0"
              title={t("publish.copy")}
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            </button>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="rounded-md glass p-1 shrink-0"
              title={t("publish.open")}
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
