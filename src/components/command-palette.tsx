import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import type { WatchlistItem } from "@/lib/watchlist-view-model";
import { ArrowUpRight, Plus, Search } from "lucide-react";
import {
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type Ref,
} from "react";

type CommandPaletteProps = {
  readonly watchlist: WatchlistItem[];
  readonly onSelectTicker: (item: WatchlistItem) => void;
  readonly onAddTicker: (query: string) => void;
};

export type CommandPaletteHandle = { open: () => void };

type PaletteEntry =
  | { readonly kind: "ticker"; readonly item: WatchlistItem }
  | { readonly kind: "add" };

const formatPrice = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

export function CommandPalette({
  watchlist,
  onSelectTicker,
  onAddTicker,
  ref,
}: CommandPaletteProps & { ref?: Ref<CommandPaletteHandle> }) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const titleId = useId();
  const listId = useId();

  useImperativeHandle(ref, () => ({ open: () => setIsOpen(true) }), []);

  const matches = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("id-ID");
    return watchlist.filter((item) =>
      `${item.ticker} ${item.companyName}`.toLocaleLowerCase("id-ID").includes(normalizedQuery),
    );
  }, [query, watchlist]);
  const entries: PaletteEntry[] = [
    ...matches.map((item): PaletteEntry => ({ kind: "ticker", item })),
    { kind: "add" },
  ];
  const selectedIndex = Math.min(activeIndex, entries.length - 1);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "k") return;
      event.preventDefault();
      if (!dialogRef.current?.open && !document.querySelector("dialog[open]")) {
        setIsOpen(true);
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
    if (isOpen) window.requestAnimationFrame(() => inputRef.current?.focus());
  }, [isOpen]);

  function closePalette() {
    if (dialogRef.current?.open) dialogRef.current.close();
    setIsOpen(false);
    setQuery("");
    setActiveIndex(0);
  }

  function selectEntry(entry: PaletteEntry) {
    closePalette();
    if (entry.kind === "add") {
      onAddTicker(query.trim());
    } else {
      onSelectTicker(entry.item);
    }
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % entries.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + entries.length) % entries.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      selectEntry(entries[selectedIndex]);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-label="Cari saham di watchlist, tekan Control atau Command K"
        aria-keyshortcuts="Control+K Meta+K"
        onClick={() => setIsOpen(true)}
        className="justify-between gap-3"
      >
        <span className="inline-flex items-center gap-2">
          <Search aria-hidden />
          Cari saham
        </span>
        <Kbd className="hidden sm:inline-flex">Ctrl K</Kbd>
      </Button>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        onCancel={(event) => {
          event.preventDefault();
          closePalette();
        }}
        onClose={() => setIsOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) closePalette();
        }}
        className="hidden open:flex fixed inset-0 m-auto max-h-[min(82dvh,42rem)] w-[min(calc(100vw-2rem),42rem)] max-w-none flex-col overflow-hidden rounded-xl border border-border/70 bg-popover p-0 text-popover-foreground shadow-2xl backdrop:bg-black/70"
      >
        <div className="border-b border-border/60 p-4 sm:p-5">
          <h2 id={titleId} className="sr-only">
            Cari saham
          </h2>
          <label htmlFor="watchlist-command-search" className="sr-only">
            Cari saham berdasarkan kode atau nama perusahaan
          </label>
          <div className="flex items-center gap-3">
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <input
              ref={inputRef}
              id="watchlist-command-search"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded="true"
              aria-controls={listId}
              aria-activedescendant={
                entries[selectedIndex] ? `palette-option-${selectedIndex}` : undefined
              }
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Cari kode atau nama perusahaan…"
              className="h-10 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground focus-visible:ring-0"
            />
            <Kbd className="shrink-0 px-1.5 py-1">ESC</Kbd>
          </div>
        </div>

        <div className="scrollbar-theme min-h-0 flex-1 overflow-y-auto p-2">
          {matches.length === 0 && (
            <p className="px-3 py-5 text-sm text-muted-foreground" role="status">
              {query.trim()
                ? `“${query.trim()}” belum ada di watchlist. Tambahkan dari direktori ticker.`
                : "Watchlist Anda masih kosong. Tambahkan ticker untuk mulai memantau."}
            </p>
          )}
          <ul id={listId} role="listbox" aria-label="Saham di watchlist" className="space-y-1">
            {matches.map((item, index) => (
              <li key={item.ticker} role="none">
                <button
                  id={`palette-option-${index}`}
                  type="button"
                  role="option"
                  aria-selected={selectedIndex === index}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => selectEntry({ kind: "ticker", item })}
                  className={`flex w-full items-center justify-between gap-4 rounded-lg px-3 py-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${
                    selectedIndex === index ? "bg-signal-soft" : "hover:bg-muted/60"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="flex items-baseline gap-2">
                      <span className="font-mono text-sm font-semibold tabular">{item.ticker}</span>
                      <span className="truncate text-sm text-muted-foreground">
                        {item.companyName || "Nama perusahaan belum tersedia"}
                      </span>
                    </span>
                    <span className="mt-1 block truncate text-xs text-muted-foreground">
                      {item.actionReason}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <span className="font-mono text-xs tabular">
                      {item.latestClose === null
                        ? "Harga belum tersedia"
                        : formatPrice.format(item.latestClose)}
                    </span>
                    <ArrowUpRight className="size-3.5 text-muted-foreground" aria-hidden />
                  </span>
                </button>
              </li>
            ))}
            <li role="none">
              <button
                id={`palette-option-${matches.length}`}
                type="button"
                role="option"
                aria-selected={selectedIndex === matches.length}
                onMouseEnter={() => setActiveIndex(matches.length)}
                onClick={() => selectEntry({ kind: "add" })}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${
                  selectedIndex === matches.length ? "bg-signal-soft" : "hover:bg-muted/60"
                }`}
              >
                <Plus className="size-4 text-signal-text" aria-hidden />
                <span>Tambah ticker{query.trim() ? ` “${query.trim()}”` : ""}</span>
              </button>
            </li>
          </ul>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-border/60 px-4 py-3 text-[11px] text-muted-foreground sm:px-5">
          <span>↑ ↓ navigasi · Enter pilih · Esc tutup</span>
          <span>{watchlist.length} saham dipantau</span>
        </footer>
      </dialog>
    </>
  );
}
