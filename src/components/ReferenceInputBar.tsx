import { useRef, useState } from "react";
import { ImagePlus, Link2, X } from "lucide-react";
import type { ReferenceInput } from "@/lib/reference-vision";

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

interface Props {
  value: ReferenceInput;
  onChange: (v: ReferenceInput) => void;
  disabled?: boolean;
}

export function ReferenceInputBar({ value, onChange, disabled }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [figmaDraft, setFigmaDraft] = useState(value.figmaUrl ?? "");

  const onFile = (file: File | null) => {
    if (!file || !file.type.startsWith("image/")) return;
    if (file.size > MAX_IMAGE_BYTES) {
      alert("图片请小于 4MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      onChange({ ...value, imageDataUrl: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col gap-2 px-3 pb-2 border-t border-border/30 pt-2">
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          disabled={disabled}
          onClick={() => fileRef.current?.click()}
          className="rounded-lg glass px-2.5 py-1 text-[11px] flex items-center gap-1 disabled:opacity-50"
          title="上传 UI 截图"
        >
          <ImagePlus className="h-3 w-3" /> 截图
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
        <div className="flex-1 min-w-[140px] flex items-center gap-1">
          <Link2 className="h-3 w-3 text-muted-foreground shrink-0" />
          <input
            value={figmaDraft}
            disabled={disabled}
            onChange={(e) => setFigmaDraft(e.target.value)}
            onBlur={() => onChange({ ...value, figmaUrl: figmaDraft.trim() || undefined })}
            placeholder="Figma 链接（可选）"
            className="flex-1 bg-transparent text-[11px] outline-none placeholder:text-muted-foreground/60"
          />
        </div>
      </div>
      {value.imageDataUrl && (
        <div className="relative inline-block w-fit">
          <img src={value.imageDataUrl} alt="参考截图" className="h-14 rounded-lg border border-border object-cover" />
          <button
            type="button"
            className="absolute -top-1 -right-1 rounded-full bg-background border border-border p-0.5"
            onClick={() => onChange({ ...value, imageDataUrl: undefined })}
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}
