import { useEffect, useState } from "react";
import { Languages } from "lucide-react";
import { api, type Language } from "../api/client";

interface LanguageSwitcherProps {
  current: Language | null;
  disabled?: boolean;
  missingCount?: number;
  onSwitch: (lang: Language) => void;
}

export function LanguageSwitcher({
  current,
  disabled,
  missingCount = 0,
  onSwitch,
}: LanguageSwitcherProps) {
  const [languages, setLanguages] = useState<Language[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await Promise.resolve();
      try {
        const res = await api.languages.list();
        if (!cancelled) {
          setLanguages((res.languages || []).filter((l) => l.active));
        }
      } catch {
        // non-fatal: language list stays empty
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="toolbar-group">
      <label className="lang-switcher" title="Switch paper language">
        <Languages size={15} strokeWidth={2} />
        <select
          value={current?.id ?? ""}
          disabled={disabled || languages.length === 0}
          onChange={(e) => {
            const lang = languages.find((l) => l.id === e.target.value);
            if (lang) onSwitch(lang);
          }}
        >
          <option value="">Paper Language</option>
          {languages.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name} ({l.code})
            </option>
          ))}
        </select>
      </label>
      {missingCount > 0 && (
        <span
          className="lang-missing-badge"
          title={`${missingCount} question(s) not available in the selected language`}
        >
          {missingCount}
        </span>
      )}
    </div>
  );
}