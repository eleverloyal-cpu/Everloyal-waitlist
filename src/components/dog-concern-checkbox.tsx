import type { InputHTMLAttributes } from "react";

type DogConcernCheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> & {
  onCheckedChange: (checked: boolean) => void;
  chip?: boolean;
};

// Native checkbox avoids a separately prebundled hook runtime for this simple field.
export function DogConcernCheckbox({ onCheckedChange, chip, ...props }: DogConcernCheckboxProps) {
  if (chip) {
    return (
      <input
        {...props}
        type="checkbox"
        className="peer sr-only"
        onChange={(event) => onCheckedChange(event.currentTarget.checked)}
      />
    );
  }
  return (
    <span className="relative inline-flex h-4 w-4 shrink-0">
      <input
        {...props}
        type="checkbox"
        onChange={(event) => onCheckedChange(event.currentTarget.checked)}
        className="peer h-4 w-4 cursor-pointer appearance-none rounded-sm border border-primary shadow checked:bg-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 hidden items-center justify-center text-xs leading-none text-primary-foreground peer-checked:flex"
      >
        ✓
      </span>
    </span>
  );
}
