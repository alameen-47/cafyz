import { lazy, type ComponentType } from "react";
import { Loader2 } from "lucide-react";

function ChunkLoadError({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 p-8 min-h-[40vh] text-center">
      <p style={{ color: "var(--cafyz-text-secondary)", fontSize: "0.9rem" }}>
        Couldn&apos;t load {label}. Check your connection and try again.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="px-4 py-2 rounded-xl text-sm font-semibold"
        style={{ background: "var(--cafyz-accent, #1e7fff)", color: "#fff" }}
      >
        Reload
      </button>
    </div>
  );
}

/** Lazy-load a page chunk with a recovery UI if the network/cache fails. */
export function lazyPage(
  loader: () => Promise<{ default: ComponentType }>,
  label: string,
) {
  return lazy(() =>
    loader().catch(err => {
      console.error(`[cafyz] failed to load ${label}`, err);
      return { default: () => <ChunkLoadError label={label} /> };
    }),
  );
}

export function PageLoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <Loader2 size={28} className="animate-spin" style={{ color: "#1e7fff" }} />
    </div>
  );
}
