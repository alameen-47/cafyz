/**
 * Veg / non-veg marking, drawn the way Indian menus and packaging show it: a square with a
 * green dot for vegetarian, a brown triangle for non-vegetarian. It sits on a white tile so
 * it reads on light and dark screens alike.
 *
 * Menu items keep their food type in the `symbol` column. Older builds wrote these two
 * characters there, so they stay the stored values; they are never shown on screen.
 */
export const VEG_SYMBOL = "\u{1F7E2}";
export const NON_VEG_SYMBOL = "\u{1F534}";

export type FoodType = "veg" | "non-veg";

/** The food type a stored menu symbol records, or null when the item has none. */
export function foodTypeOf(symbol?: string | null): FoodType | null {
  if (symbol === VEG_SYMBOL) return "veg";
  if (symbol === NON_VEG_SYMBOL) return "non-veg";
  return null;
}

const MARK_COLOR: Record<FoodType, string> = { veg: "#15803d", "non-veg": "#8a3b12" };

export function FoodTypeMark({ type, size = 14, className = "" }: { type: FoodType; size?: number; className?: string }) {
  const color = MARK_COLOR[type];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      role="img"
      aria-label={type === "veg" ? "Vegetarian" : "Non-vegetarian"}
      className={`inline-block flex-shrink-0 ${className}`}
    >
      <rect x="0.75" y="0.75" width="14.5" height="14.5" rx="2.5" fill="#fff" stroke={color} strokeWidth="1.5" />
      {type === "veg"
        ? <circle cx="8" cy="8" r="3.9" fill={color} />
        : <path d="M8 3.7 12.3 11.5H3.7Z" fill={color} />}
    </svg>
  );
}
