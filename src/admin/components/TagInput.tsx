import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { api } from "../../api/client";

const inputCls =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-black outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15";

export interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
}

export function TagInput({ tags, onChange }: TagInputProps) {
  const [allTags, setAllTags] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load existing tags on mount
  useEffect(() => {
    api.tags.list().then((r) => setAllTags(r.tags)).catch(() => {});
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const existingSet = new Set(allTags.map((t) => t.toLowerCase()));
  const selectedSet = new Set(tags.map((t) => t.toLowerCase()));

  const trimmed = input.trim();
  const lowerTrimmed = trimmed.toLowerCase();

  // Filtered suggestions: match input, not already selected
  const suggestions = trimmed
    ? allTags.filter((t) => t.toLowerCase().includes(lowerTrimmed) && !selectedSet.has(t.toLowerCase()))
    : allTags.filter((t) => !selectedSet.has(t.toLowerCase()));

  const isNew = trimmed.length > 0 && !existingSet.has(lowerTrimmed);

  const addTag = useCallback(
    (value: string) => {
      const v = value.trim();
      if (!v) return;
      if (selectedSet.has(v.toLowerCase())) return;
      onChange([...tags, v]);
      setInput("");
      setOpen(false);
      inputRef.current?.focus();
    },
    [tags, onChange, selectedSet],
  );

  const removeTag = useCallback(
    (value: string) => {
      onChange(tags.filter((t) => t !== value));
    },
    [tags, onChange],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (trimmed) addTag(trimmed);
    }
    if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const handleChange = (value: string) => {
    // Comma-separated: add all complete segments immediately
    if (value.includes(",")) {
      const parts = value.split(",");
      const last = parts.pop()!;
      for (const part of parts) {
        const v = part.trim();
        if (v && !selectedSet.has(v.toLowerCase())) {
          onChange([...tags, v]);
        }
      }
      setInput(last);
      return;
    }
    setInput(value);
  };

  return (
    <div ref={wrapRef} className="relative">
      {/* Selected tags as pills */}
      {tags.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <button
              type="button"
              key={t}
              onClick={() => removeTag(t)}
              className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-medium text-primary hover:bg-red-50 hover:text-red-600"
            >
              {t} <X className="h-3 w-3" aria-hidden />
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <input
        ref={inputRef}
        value={input}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        className={inputCls}
        placeholder="Type a tag, comma to add…"
      />

      {/* Dropdown */}
      {open && (trimmed ? (suggestions.length > 0 || isNew) : suggestions.length > 0) && (
        <div className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
          {suggestions.slice(0, 10).map((t) => (
            <button
              type="button"
              key={t}
              onMouseDown={(e) => {
                e.preventDefault();
                addTag(t);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
            >
              <span className="truncate">{highlightMatch(t, trimmed)}</span>
              {selectedSet.has(t.toLowerCase()) && (
                <span className="ml-auto shrink-0 text-xs text-slate-400">added</span>
              )}
            </button>
          ))}
          {isNew && (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                addTag(trimmed);
              }}
              className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2 text-left text-sm font-medium text-primary hover:bg-slate-50"
            >
              + Create "{trimmed}"
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx < 0) return text;
  return (
    <>
      {text.slice(0, idx)}
      <span className="font-semibold text-primary">{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </>
  );
}
