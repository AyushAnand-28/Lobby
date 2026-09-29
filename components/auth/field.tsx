import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Labelled input with inline validation message.
 *
 * The error is wired through `aria-describedby` and `aria-invalid` rather than
 * just coloured red — organizers fill this in on a phone, often outdoors.
 */
export function Field({
  name,
  // Defaults to the field name, but must be overridden when two forms on the
  // same screen post the same field — duplicate ids break label association.
  id = name,
  label,
  error,
  hint,
  ...inputProps
}: React.ComponentProps<typeof Input> & {
  name: string;
  label: string;
  error?: string;
  hint?: string;
}) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [error ? errorId : null, hint ? hintId : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="grid gap-2.5">
      {/*
        `text-foreground`, never `text-ink`: `ink` is the dark surface colour,
        which on this ground would be black text on black.
      */}
      <Label
        htmlFor={id}
        className="text-sm font-light text-foreground/60 uppercase"
      >
        {label}
      </Label>
      <Input
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        /* Taller and squarer than the default — these are filled on a phone. */
        className="h-12 rounded-none border-border bg-transparent px-3.5 text-base"
        {...inputProps}
      />
      {hint ? (
        <p id={hintId} className="text-sm font-light text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** First message for a field, or undefined. */
export function fieldError(
  fieldErrors: Record<string, string[] | undefined> | undefined,
  name: string,
): string | undefined {
  return fieldErrors?.[name]?.[0];
}
