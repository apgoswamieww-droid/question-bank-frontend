import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Languages, Link2, Loader2, Search, X } from "lucide-react";
import { api, ApiError, type Language, type Question, type QuestionVariant } from "../../api/client";
import { Button } from "./Button";

interface LinkVariantModalProps {
  open: boolean;
  questionId: string | null;
  languages: Language[];
  onClose: () => void;
  onLinked: (familyId: string | null) => void;
  onCreateVariant: () => void;
}

function plainHtml(value: unknown): string {
  const html = typeof value === "string" ? value : (value as { html?: string } | null)?.html ?? "";
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function LinkVariantModal({
  open,
  questionId,
  languages,
  onClose,
  onLinked,
  onCreateVariant,
}: LinkVariantModalProps) {
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [variants, setVariants] = useState<QuestionVariant[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Question[]>([]);
  const [searching, setSearching] = useState(false);
  const [linkingId, setLinkingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !questionId) return;
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const res = await api.questions.variants(questionId);
        if (cancelled) return;
        setFamilyId(res.family_id);
        setVariants(res.variants);
      } catch (err) {
        if (cancelled) return;
        toast.error(err instanceof ApiError ? err.message : "Failed to load variants.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [open, questionId]);

  const knownIds = useMemo(() => new Set(variants.map((v) => v.id)), [variants]);

  const handleSearch = async () => {
    const term = search.trim();
    if (!term) return;
    setSearching(true);
    setResults([]);
    try {
      const res = await api.questions.list({ search: term, limit: 20 });
      setResults(res.questions.filter((q) => !knownIds.has(q.id)));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Search failed.");
    } finally {
      setSearching(false);
    }
  };

  const handleLink = async (targetId: string) => {
    if (!questionId) return;
    setLinkingId(targetId);
    try {
      if (familyId) {
        await api.questions.linkVariant(targetId, familyId);
      } else {
        const source = await api.questions.linkVariant(questionId, null);
        await api.questions.linkVariant(targetId, source.family_id);
        setFamilyId(source.family_id);
      }
      const res = await api.questions.variants(questionId);
      setVariants(res.variants);
      setFamilyId(res.family_id);
      onLinked(res.family_id);
      setResults((prev) => prev.filter((q) => q.id !== targetId));
      toast.success("Linked as a language variant.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to link variant.");
    } finally {
      setLinkingId(null);
    }
  };

  if (!open || !questionId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Link language variant">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <Languages className="h-5 w-5 text-primary" aria-hidden />
            <div>
              <h2 className="text-sm font-bold text-slate-900">Language Variants</h2>
              <p className="text-xs text-slate-500">
                Same logical question in different languages (shared family)
                {familyId ? ` · family ${familyId.slice(0, 8)}…` : ""}
              </p>
            </div>
          </div>
          <Button size="sm" variant="ghost" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" aria-hidden />
          </Button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading…
            </div>
          ) : (
            <>
              <section className="rounded-xl border border-slate-200 p-4">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Linked variants ({variants.length})
                </h3>
                {variants.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    This question is not linked to any family yet. Linking another question will create a new family.
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {variants.map((v) => {
                      const lang = languages.find((l) => l.id === v.language_id);
                      return (
                        <li key={v.id} className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-sm">
                          <span className="shrink-0 rounded-full bg-primary-50 px-2 py-0.5 text-xs font-semibold text-primary">
                            {lang?.name ?? "No language"}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-slate-700">
                            {plainHtml(v.content) || "Untitled question"}
                          </span>
                          {v.id === questionId && (
                            <span className="shrink-0 text-xs text-slate-400">current</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <section className="rounded-xl border border-slate-200 p-4">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Link from question bank
                </h3>
                <div className="flex gap-2">
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleSearch();
                      }
                    }}
                    placeholder="Search existing questions by text / tags…"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-black placeholder:text-slate-400 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15"
                  />
                  <Button variant="secondary" onClick={handleSearch} loading={searching}>
                    <Search className="h-4 w-4" aria-hidden /> Search
                  </Button>
                </div>

                {results.length > 0 && (
                  <ul className="mt-3 space-y-1">
                    {results.map((q) => (
                      <li key={q.id} className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-sm">
                        <span className="min-w-0 flex-1 truncate text-slate-700">
                          {plainHtml(q.content) || "Untitled question"}
                        </span>
                        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                          {q.type.replace("_", " ")}
                        </span>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleLink(q.id)}
                          loading={linkingId === q.id}
                          disabled={Boolean(linkingId) && linkingId !== q.id}
                        >
                          <Link2 className="h-3.5 w-3.5" aria-hidden /> Link
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
                {!searching && search.trim() && results.length === 0 && !loading && (
                  <p className="mt-3 text-sm text-slate-400">No matching questions found.</p>
                )}
              </section>
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-5 py-4">
          <p className="text-xs text-slate-500">
            Tip: save a new question in another language with the same hierarchy to create a variant, then link it here.
          </p>
          <Button variant="secondary" onClick={onCreateVariant}>
            + New variant from current
          </Button>
        </div>
      </div>
    </div>
  );
}