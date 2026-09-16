import { useState, useRef, useEffect } from "react";
import { X } from "lucide-react";

const EMOJI_CATEGORIES = [
  {
    label: "Education",
    emojis: ["📐", "📊", "🧮", "📏", "✏️", "📝", "📖", "📚", "🎓", "🏫", "🎒", "🖊️", "🖋️", "📒", "📑", "🗂️", "📋", "📁"],
  },
  {
    label: "Science",
    emojis: ["🧪", "🔬", "🧬", "🌿", "🌍", "⚡", "🔋", "💡", "🔭", "🌡️", "🧲", "⚙️", "🪐", "🌊", "🔥", "❄️", "🌈", "☁️"],
  },
  {
    label: "Math",
    emojis: ["🔢", "➕", "➖", "➗", "🟰", "∫", "∑", "∞", "π", "√", "△", "◇", "📏", "📐", "🧮", "💻", "🖥️", "⌨️"],
  },
  {
    label: "General",
    emojis: ["⭐", "🍎", "📌", "🔧", "🎨", "🏆", "🎵", "🎯", "💡", "✅", "📌", "🔍", "📊", "🗓️", "⏰", "📍", "🔑", "💬"],
  },
] as const;

interface IconPickerProps {
  value: string | null;
  onChange: (emoji: string | null) => void;
}

export function IconPicker({ value, onChange }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-xl transition hover:border-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          title="Choose icon"
        >
          {value ?? "📁"}
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="flex h-6 w-6 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            title="Clear icon"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
          {EMOJI_CATEGORIES.map((cat) => (
            <div key={cat.label} className="mb-2 last:mb-0">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{cat.label}</p>
              <div className="flex flex-wrap gap-0.5">
                {cat.emojis.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => { onChange(emoji); setOpen(false); }}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg text-base transition hover:bg-slate-100 ${
                      value === emoji ? "bg-primary/10 ring-1 ring-primary" : ""
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
