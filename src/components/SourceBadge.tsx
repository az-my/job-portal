import { sourceColor, sourceLabel } from "@/lib/sources";

export function SourceBadge({ source }: { source?: string }) {
  const color = sourceColor(source);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{
        color,
        background: `color-mix(in oklch, ${color} 14%, transparent)`,
        boxShadow: `inset 0 0 0 1px color-mix(in oklch, ${color} 35%, transparent)`,
      }}
    >
      <span className="size-1.5 rounded-full" style={{ background: color }} />
      {sourceLabel(source)}
    </span>
  );
}
