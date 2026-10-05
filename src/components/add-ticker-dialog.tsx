import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  CompanyScreenerResponse,
  CompanyScreenerResult,
} from "@/shared/schemas/company-search.ts";
import { CompanyScreenerResponseSchema } from "@/shared/schemas/company-search.ts";
import { TickerSchema } from "@/shared/schemas/investigation.ts";
import { LoaderCircle, Plus, Search, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

type AddTickerDialogProps = {
  readonly isOpen: boolean;
  readonly query: string;
  readonly existingTickers: string[];
  readonly onClose: () => void;
  readonly onQueryChange: (query: string) => void;
  readonly onAdd: (ticker: string) => Promise<string | null>;
};

const PAGE_SIZE = 10;

export function AddTickerDialog({
  isOpen,
  query,
  existingTickers,
  onClose,
  onQueryChange,
  onAdd,
}: AddTickerDialogProps) {
  const normalizedQuery = query.trim();
  const [response, setResponse] = useState<CompanyScreenerResponse | null>(null);
  const [searchState, setSearchState] = useState<{
    query: string;
    retryKey: number;
    error?: string;
  } | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);
  const [addingTicker, setAddingTicker] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const requestIdRef = useRef(0);
  const moreControllerRef = useRef<AbortController | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  const hasCurrentSearch =
    searchState?.query === normalizedQuery && searchState.retryKey === retryKey;
  const isSearching = isOpen && normalizedQuery.length !== 1 && !hasCurrentSearch;
  const searchError = hasCurrentSearch ? (searchState.error ?? null) : null;
  const currentResponse = hasCurrentSearch && !searchState.error ? response : null;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
    if (isOpen) window.requestAnimationFrame(() => inputRef.current?.focus());
  }, [isOpen]);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    moreControllerRef.current?.abort();

    if (!isOpen) return;

    const searchQuery = query.trim();
    if (searchQuery.length === 1) return;

    const controller = new AbortController();
    const timer = window.setTimeout(
      () => {
        void (async () => {
          try {
            const params = new URLSearchParams({
              q: searchQuery,
              limit: String(PAGE_SIZE),
              offset: "0",
            });
            const result = await fetch(`/api/companies/search?${params}`, {
              signal: controller.signal,
            });
            const body: unknown = await result.json().catch(() => null);
            if (!result.ok) {
              throw new Error(
                result.status === 502
                  ? "Direktori perusahaan sedang tidak tersedia. Coba lagi."
                  : "Pencarian tidak dapat diproses. Periksa kata kunci Anda.",
              );
            }

            const parsed = CompanyScreenerResponseSchema.safeParse(body);
            if (!parsed.success) {
              throw new Error("Format daftar perusahaan tidak dikenali. Coba ulangi pencarian.");
            }
            if (requestId === requestIdRef.current) {
              setResponse(parsed.data);
              setSearchState({ query: searchQuery, retryKey });
            }
          } catch (error) {
            if (controller.signal.aborted || requestId !== requestIdRef.current) return;
            setSearchState({
              query: searchQuery,
              retryKey,
              error:
                error instanceof Error
                  ? error.message
                  : "Pencarian ticker gagal. Silakan coba lagi.",
            });
          }
        })();
      },
      searchQuery ? 220 : 0,
    );

    return () => {
      window.clearTimeout(timer);
      controller.abort();
      if (requestIdRef.current === requestId) requestIdRef.current += 1;
    };
  }, [isOpen, query, retryKey]);

  const handleLoadMore = async () => {
    const nextOffset = currentResponse?.pagination.next_offset;
    if (nextOffset === null || nextOffset === undefined || isLoadingMore) return;

    const requestId = requestIdRef.current;
    const controller = new AbortController();
    moreControllerRef.current?.abort();
    moreControllerRef.current = controller;
    setIsLoadingMore(true);
    setMoreError(null);

    try {
      const params = new URLSearchParams({
        q: query.trim(),
        limit: String(PAGE_SIZE),
        offset: String(nextOffset),
      });
      const result = await fetch(`/api/companies/search?${params}`, {
        signal: controller.signal,
      });
      const body: unknown = await result.json().catch(() => null);
      if (!result.ok) throw new Error("Opsi berikutnya tidak dapat dimuat. Coba lagi.");

      const parsed = CompanyScreenerResponseSchema.safeParse(body);
      if (!parsed.success) throw new Error("Format daftar perusahaan tidak dikenali.");
      if (requestId === requestIdRef.current) {
        setResponse((current) =>
          current
            ? { ...parsed.data, results: [...current.results, ...parsed.data.results] }
            : parsed.data,
        );
      }
    } catch (error) {
      if (controller.signal.aborted || requestId !== requestIdRef.current) return;
      setMoreError(error instanceof Error ? error.message : "Opsi berikutnya gagal dimuat.");
    } finally {
      if (!controller.signal.aborted && requestId === requestIdRef.current) {
        setIsLoadingMore(false);
      }
    }
  };

  function closeDialog() {
    moreControllerRef.current?.abort();
    setIsLoadingMore(false);
    setMoreError(null);
    if (dialogRef.current?.open) dialogRef.current.close();
    else onClose();
  }

  async function addCompany(company: CompanyScreenerResult) {
    const parsedTicker = TickerSchema.safeParse(company.symbol);
    if (!parsedTicker.success) {
      setAddError("Simbol ini belum didukung. Pilih ticker IDX empat huruf.");
      return;
    }

    const ticker = parsedTicker.data;
    if (existingTickers.includes(ticker)) {
      setAddError(`${ticker} sudah ada di watchlist.`);
      return;
    }

    setAddingTicker(ticker);
    setAddError(null);
    try {
      const error = await onAdd(ticker);
      if (error) {
        setAddError(error);
        return;
      }
      closeDialog();
    } catch (error) {
      setAddError(error instanceof Error ? error.message : `Tidak dapat menambahkan ${ticker}.`);
    } finally {
      setAddingTicker(null);
    }
  }

  const existingSet = new Set(existingTickers);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault();
        closeDialog();
      }}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) closeDialog();
      }}
      className="hidden open:flex fixed inset-0 m-auto max-h-[min(88dvh,48rem)] w-[min(calc(100vw-2rem),38rem)] max-w-none flex-col overflow-hidden rounded-xl border border-border/70 bg-popover p-0 text-popover-foreground shadow-2xl backdrop:bg-black/70"
    >
      <header className="flex items-start justify-between gap-4 border-b border-border/60 px-4 py-4 sm:px-5">
        <div>
          <h2 id={titleId} className="text-lg font-semibold">
            Tambah ticker
          </h2>
          <p
            id={descriptionId}
            className="mt-1 max-w-[52ch] text-xs leading-relaxed text-muted-foreground"
          >
            Cari berdasarkan kode saham atau nama perusahaan, lalu pilih saham yang ingin dipantau.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Tutup tambah ticker"
          onClick={closeDialog}
        >
          <X aria-hidden />
        </Button>
      </header>

      <div className="grid gap-2 px-4 pt-4 sm:px-5">
        <Label htmlFor="company-search">Kode atau nama perusahaan</Label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            ref={inputRef}
            id="company-search"
            value={query}
            onChange={(event) => {
              moreControllerRef.current?.abort();
              setIsLoadingMore(false);
              setMoreError(null);
              onQueryChange(event.target.value);
              setAddError(null);
            }}
            autoComplete="off"
            autoCapitalize="characters"
            placeholder="Contoh: BBCA atau Bank Central Asia"
            aria-describedby="company-search-help"
            className="h-10 pl-9"
          />
        </div>
        <p id="company-search-help" className="text-xs text-muted-foreground">
          Daftar awal menampilkan ticker dari direktori contoh. Ketik minimal 2 karakter untuk
          menyaring.
        </p>
      </div>

      <div className="mx-4 mt-4 flex items-start gap-2 border-y border-border/50 py-3 text-xs leading-relaxed text-muted-foreground sm:mx-5">
        <span className="mt-0.5 shrink-0 rounded border border-signal/50 bg-signal-soft px-1.5 py-0.5 font-mono text-[10px] text-foreground">
          DEMO
        </span>
        <p>Direktori contoh, belum mengambil hasil langsung dari Sectors REST API.</p>
      </div>

      {addError && (
        <p className="mx-4 mt-3 text-sm text-destructive sm:mx-5" role="alert">
          {addError}
        </p>
      )}

      <div className="scrollbar-theme min-h-0 flex-1 overflow-y-auto px-4 py-2 sm:px-5">
        {normalizedQuery.length === 1 ? (
          <p className="py-6 text-center text-sm text-muted-foreground" role="status">
            Ketik satu karakter lagi untuk mencari kode atau nama perusahaan.
          </p>
        ) : isSearching ? (
          <div className="space-y-1 py-1" role="status" aria-label="Memuat daftar perusahaan">
            <span className="sr-only">Mencari perusahaan…</span>
            {[0, 1, 2, 3].map((row) => (
              <div key={row} aria-hidden className="flex items-center gap-3 rounded-lg px-3 py-3">
                <span className="size-8 animate-pulse rounded-md bg-muted/80" />
                <span className="flex-1 space-y-2">
                  <span className="block h-3 w-16 animate-pulse rounded bg-muted/80" />
                  <span className="block h-3 w-2/3 animate-pulse rounded bg-muted/60" />
                </span>
              </div>
            ))}
          </div>
        ) : searchError ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center" role="alert">
            <p className="text-sm text-muted-foreground">{searchError}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRetryKey((key) => key + 1)}
            >
              Coba lagi
            </Button>
          </div>
        ) : currentResponse?.results.length ? (
          <>
            <p className="py-2 text-xs text-muted-foreground" role="status">
              Menampilkan {currentResponse.results.length} dari{" "}
              {currentResponse.pagination.total_count} perusahaan
            </p>
            <ul className="divide-y divide-border/40" aria-label="Hasil pencarian perusahaan">
              {currentResponse.results.map((company) => {
                const parsedTicker = TickerSchema.safeParse(company.symbol);
                const ticker = parsedTicker.success ? parsedTicker.data : company.symbol;
                const isExisting = parsedTicker.success && existingSet.has(ticker);
                const isAdding = addingTicker === ticker;
                const isDisabled = !parsedTicker.success || isExisting || addingTicker !== null;

                return (
                  <li key={company.symbol}>
                    <button
                      type="button"
                      disabled={isDisabled}
                      onClick={() => void addCompany(company)}
                      className="flex w-full items-center justify-between gap-4 rounded-lg px-3 py-3 text-left outline-none transition-colors hover:bg-muted/45 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-55"
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span className="grid size-9 shrink-0 place-items-center rounded-md bg-signal-soft font-mono text-[10px] font-semibold text-signal-text">
                          {ticker.replace(/\.JK$/i, "").slice(0, 4)}
                        </span>
                        <span className="min-w-0">
                          <span className="block font-mono text-sm font-semibold tabular">
                            {ticker.replace(/\.JK$/i, "")}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {company.company_name}
                          </span>
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                        {isAdding ? (
                          <>
                            <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
                            Menambahkan
                          </>
                        ) : isExisting ? (
                          "Sudah ada"
                        ) : parsedTicker.success ? (
                          <>
                            <Plus className="size-3.5" aria-hidden />
                            Tambahkan
                          </>
                        ) : (
                          "Format tidak didukung"
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {moreError && (
              <div className="flex items-center justify-between gap-3 py-3 text-xs" role="alert">
                <p className="text-destructive">{moreError}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void handleLoadMore()}
                >
                  Coba lagi
                </Button>
              </div>
            )}
            {currentResponse.pagination.has_next && !moreError && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="my-2 w-full"
                disabled={isLoadingMore}
                onClick={() => void handleLoadMore()}
              >
                {isLoadingMore ? "Memuat opsi berikutnya…" : "Muat lebih banyak"}
              </Button>
            )}
          </>
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground" role="status">
            Tidak ada perusahaan yang cocok. Coba kode atau nama yang lebih pendek.
          </p>
        )}
      </div>
    </dialog>
  );
}
