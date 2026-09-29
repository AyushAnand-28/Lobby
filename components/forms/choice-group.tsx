import { cn } from "@/lib/utils";

export type Choice<T extends string> = {
  value: T;
  label: string;
  detail?: string;
};

/**
 * A set of radio buttons drawn as cards — one tap target per option, with room
 * for a line explaining it. Native radios underneath, so it posts with the
 * form, works with the keyboard, and needs no JavaScript.
 *
 * Pass `value` and `onValueChange` when other fields depend on the choice;
 * otherwise `defaultValue` leaves it to the browser.
 */
export function ChoiceGroup<T extends string>({
  name,
  legend,
  choices,
  value,
  defaultValue,
  onValueChange,
  error,
  columns = 1,
  disabled = false,
}: {
  name: string;
  legend: string;
  choices: readonly Choice<T>[];
  value?: T;
  defaultValue?: string;
  onValueChange?: (value: T) => void;
  error?: string;
  columns?: 1 | 2 | 3;
  /**
   * Shown but fixed. Disabled radios do not post, so the chosen value is sent
   * in a hidden input instead.
   */
  disabled?: boolean;
}) {
  const errorId = `${name}-error`;

  return (
    <>
      <fieldset
        disabled={disabled}
        className="grid gap-2.5 disabled:opacity-60"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
      >
        <legend className="mb-2.5 text-sm font-light text-foreground/60 uppercase">{legend}</legend>
        <div
          className={cn(
            "grid gap-2",
            columns === 2 && "sm:grid-cols-2",
            columns === 3 && "sm:grid-cols-3",
          )}
        >
          {choices.map((choice) => (
            <label
              key={choice.value}
              className={cn(
                "flex cursor-pointer flex-col gap-1.5 border border-border p-4 transition-colors in-disabled:cursor-not-allowed",
                "hover:border-foreground/40 has-checked:border-foreground has-checked:bg-mist",
                "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring",
              )}
            >
              <input
                type="radio"
                name={name}
                value={choice.value}
                className="sr-only"
                {...(value !== undefined
                  ? {
                      checked: value === choice.value,
                      onChange: () => onValueChange?.(choice.value),
                    }
                  : { defaultChecked: defaultValue === choice.value })}
              />
              <span className="text-base font-medium">{choice.label}</span>
              {choice.detail ? (
                <span className="text-sm leading-relaxed font-light text-foreground/60">
                  {choice.detail}
                </span>
              ) : null}
            </label>
          ))}
        </div>
        {error ? (
          <p id={errorId} className="text-sm font-medium text-destructive">
            {error}
          </p>
        ) : null}
      </fieldset>
      {/* Outside the fieldset: a disabled fieldset disables everything inside it. */}
      {disabled ? <input type="hidden" name={name} value={value ?? defaultValue ?? ""} /> : null}
    </>
  );
}
