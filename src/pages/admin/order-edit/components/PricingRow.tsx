export function PricingRow({
  label,
  value,
  negative,
  fieldKey,
  editingField,
  editingFieldValue,
  setEditingField,
  setEditingFieldValue,
  onSave,
}: {
  label: string;
  value: number;
  negative?: boolean;
  fieldKey?: string;
  editingField?: string | null;
  editingFieldValue?: string;
  setEditingField?: (f: string | null) => void;
  setEditingFieldValue?: (v: string) => void;
  onSave?: (val: number) => void;
}) {
  const isEditing = fieldKey && editingField === fieldKey;
  const editable = !!fieldKey && !!onSave;

  return (
    <div className="flex flex-col items-center justify-center py-2">
      <span className="text-[10px] text-muted-foreground leading-none">{label}</span>
      {isEditing ? (
        <input
          type="number"
          autoFocus
          className="w-16 h-7 text-center text-sm font-semibold border border-primary rounded bg-background outline-none mt-0.5"
          value={editingFieldValue}
          onChange={(e) => setEditingFieldValue?.(e.target.value)}
          onFocus={(e) => {
            if (e.target.value === "0") {
              setEditingFieldValue?.("");
            }
          }}
          onBlur={() => {
            const raw = editingFieldValue?.trim();
            const val = parseFloat(raw || "0");
            onSave?.(isNaN(val) ? 0 : val);
            setEditingField?.(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") setEditingField?.(null);
          }}
        />
      ) : (
        <span
          className={`text-base font-bold mt-0.5 ${editable ? "cursor-pointer hover:text-primary hover:underline" : ""} ${negative && value > 0 ? "text-destructive" : ""}`}
          onDoubleClick={() => {
            if (editable) {
              setEditingField?.(fieldKey!);
              setEditingFieldValue?.(String(value));
            }
          }}
          title={editable ? "Double-click to edit" : undefined}
        >
          {negative && value > 0 ? `-৳${value}` : `৳${value}`}
        </span>
      )}
    </div>
  );
}
