import { Check } from "lucide-react";

export interface ChoiceCardOption {
  value: string;
  label: string;
  description?: string;
  badge?: string;
  disabled?: boolean;
}

interface Props {
  label: string;
  value: string;
  options: ChoiceCardOption[];
  onChange: (value: string) => void;
  columns?: 1 | 2 | 3;
}

export function ChoiceCards({ label, value, options, onChange, columns = 2 }: Props) {
  const grid = columns === 1 ? "grid-cols-1" : columns === 3 ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" : "grid-cols-1 sm:grid-cols-2";
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-xs font-semibold text-slate-300">{label}</legend>
      <div role="group" aria-label={label} className={`grid ${grid} gap-2`}>
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              disabled={option.disabled}
              onClick={() => onChange(option.value)}
              className={`flex min-h-14 w-full items-start gap-3 rounded-xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:cursor-not-allowed disabled:opacity-40 ${selected ? "border-sky-400/70 bg-sky-400/10 shadow-[0_0_0_1px_rgba(56,189,248,0.15)]" : "border-slate-700 bg-slate-950/70 hover:border-slate-500 hover:bg-slate-800/70"}`}
            >
              <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${selected ? "border-sky-300 bg-sky-300 text-slate-950" : "border-slate-600 text-transparent"}`}>
                {selected && <Check className="h-3 w-3" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className={`text-sm font-semibold ${selected ? "text-sky-100" : "text-slate-200"}`}>{option.label}</span>
                  {option.badge && <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-400">{option.badge}</span>}
                </span>
                {option.description && <span className="mt-1 block text-xs leading-relaxed text-slate-500">{option.description}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
