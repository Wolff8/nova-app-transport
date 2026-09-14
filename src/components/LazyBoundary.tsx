import { Component, type ReactNode } from 'react';

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
type Props = { name: string; children: ReactNode };
type State = { failed: boolean; reason: string };

const STALE_CHUNK = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError|Loading chunk|MIME type|module script/i;
const RELOAD_KEY = 'nova:chunk-reload';

export class LazyBoundary extends Component<Props, State> {
  // React 19 ships no type declarations and @types/react is not installed, so
  // `Component` is untyped here; declaring the field keeps `this.props` typed
  // without changing anything at runtime.
  declare readonly props: Readonly<Props>;
  state: State = { failed: false, reason: '' };

  static getDerivedStateFromError(error: unknown): State {
    return { failed: true, reason: String((error as any)?.message ?? error).slice(0, 160) };
  }

  componentDidCatch(error: unknown) {
    const msg = String((error as any)?.message ?? error);
    console.error(`[${this.props.name}] panel failed:`, msg, (error as any)?.stack);
    if (!STALE_CHUNK.test(msg)) return;
    let reloadedAt = 0;
    try { reloadedAt = Number(sessionStorage.getItem(RELOAD_KEY) || 0); } catch {}
    // One automatic reload per minute: enough to pick up a deploy, never a loop.
    if (Date.now() - reloadedAt > 60 * 1000) {
      try { sessionStorage.setItem(RELOAD_KEY, String(Date.now())); } catch {}
      freshReload();
    }
  }

  render() {
    if (this.state.failed) {
      const stale = STALE_CHUNK.test(this.state.reason);
      return (
        <div className="absolute bottom-16 left-3 right-3 sm:left-auto sm:w-80 z-50 rounded-xl border border-amber-500/40 bg-panel/95 backdrop-blur px-3 py-2 text-[11px] font-mono text-amber-200 space-y-1.5">
          <div>{stale ? 'Stran je iz starejše različice, panel manjka.' : `Panel se je sesul: ${this.state.reason}`}</div>
          <button type="button" onClick={freshReload} className="w-full rounded-lg border border-amber-400/50 bg-amber-500/15 px-2 py-1.5 text-[11px] font-bold text-amber-100 active:bg-amber-500/30">
            Naloži najnovejšo različico
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * A reload that cannot be answered from a cached copy of the page: the query
 * string changes, so the browser has to ask the server for index.html and
 * gets the chunk names of the version that is actually deployed.
 */
function freshReload() {
  const u = new URL(window.location.href);
  u.searchParams.set('v', String(Date.now()));
  window.location.replace(u.toString());
}
