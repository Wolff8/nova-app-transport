import React from 'react';

/**
 * Keeps one failing panel from taking the whole app down.
 *
 * The panels are loaded on demand as separate chunks. When a new version is
 * deployed while a page is open, the chunks the open page refers to no longer
 * exist, so the first click on a vehicle fetches a file that is gone. Without
 * a boundary that error unmounted the entire React tree — which also called
 * the map controller's destroy(), stopping every poll, so vehicles froze at
 * 0 km/h and nothing responded. This is what "the app stopped working" was.
 *
 * A stale-chunk error is answered with one reload, which picks up the new
 * version; any other error just hides the panel and leaves the map running.
 */
type Props = { name: string; children: React.ReactNode };
type State = { failed: boolean };

const STALE_CHUNK = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError|Loading chunk/i;
const RELOAD_KEY = 'nova:chunk-reload';

export class LazyBoundary extends React.Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State { return { failed: true }; }

  componentDidCatch(error: unknown) {
    const msg = String((error as any)?.message ?? error);
    console.error(`[${this.props.name}] panel failed:`, msg);
    if (!STALE_CHUNK.test(msg)) return;
    let reloadedAt = 0;
    try { reloadedAt = Number(sessionStorage.getItem(RELOAD_KEY) || 0); } catch {}
    // One reload per ten minutes: enough to pick up a deploy, never a loop.
    if (Date.now() - reloadedAt > 10 * 60 * 1000) {
      try { sessionStorage.setItem(RELOAD_KEY, String(Date.now())); } catch {}
      window.location.reload();
    }
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="absolute bottom-16 left-3 right-3 sm:left-auto sm:w-80 z-50 rounded-xl border border-amber-500/40 bg-panel/95 backdrop-blur px-3 py-2 text-[11px] font-mono text-amber-200">
          Panel ni na voljo v tej seji — osveži stran.
        </div>
      );
    }
    return this.props.children;
  }
}
