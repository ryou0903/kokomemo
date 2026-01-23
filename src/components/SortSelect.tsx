import type { SortOption } from '../types';

interface SortSelectProps {
  value: SortOption;
  onChange: (value: SortOption) => void;
}

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'created-desc', label: '登録が新しい順' },
  { value: 'created-asc', label: '登録が古い順' },
  { value: 'name-asc', label: 'あいうえお順' },
];

export function SortSelect({ value, onChange }: SortSelectProps) {
  return (
    <div className="px-4 py-2">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as SortOption)}
        className="w-full rounded-xl border-2 border-border bg-white px-4 py-3 text-lg text-text focus:border-primary focus:outline-none"
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
