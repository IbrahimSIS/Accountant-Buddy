/**
 * Centralized, deterministic color mapping for expense and income categories.
 *
 * WHY THIS EXISTS:
 * Previously colors were assigned by array index (position-based), so the same
 * category could receive different colors depending on its rank in a given month.
 * A fixed map guarantees visual consistency across charts, legends, and tooltips.
 *
 * RULE: "Uncategorized" is always gray so it visually stands out as needing attention.
 */

const EXPENSE_CATEGORY_COLORS: Record<string, string> = {
  "Office Expenses":                        "hsl(221, 83%, 40%)",
  "Purchases":                              "hsl(173, 58%, 45%)",
  "Rent":                                   "hsl(262, 52%, 55%)",
  "Utilities (Electricity, Water, Internet)":"hsl(38, 92%, 50%)",
  "Salaries & Wages":                       "hsl(142, 71%, 45%)",
  "Marketing & Advertising":                "hsl(348, 83%, 47%)",
  "Transportation":                         "hsl(187, 85%, 43%)",
  "Software & Subscriptions":               "hsl(28, 80%, 52%)",
  "Professional Fees (Accounting, Legal)":   "hsl(270, 50%, 60%)",
  "Maintenance & Repairs":                  "hsl(200, 60%, 50%)",
  "Bank Fees":                              "hsl(330, 60%, 50%)",
  "Taxes & Government Fees":                "hsl(15, 70%, 50%)",
  "Other Expenses":                         "hsl(215, 16%, 57%)",
};

const INCOME_CATEGORY_COLORS: Record<string, string> = {
  "Sales / Revenue":   "hsl(173, 58%, 39%)",
  "Service Income":    "hsl(142, 71%, 45%)",
  "Rental Income":     "hsl(221, 83%, 53%)",
  "Commission Income": "hsl(38, 92%, 50%)",
  "Other Income":      "hsl(262, 52%, 55%)",
};

/** Gray for any transaction that lacks a valid category */
const UNCATEGORIZED_COLOR = "hsl(215, 16%, 68%)";

/** Fallback palette for categories not in the fixed maps (e.g. user-created) */
const FALLBACK_PALETTE = [
  "hsl(190, 60%, 50%)",
  "hsl(310, 50%, 55%)",
  "hsl(55, 70%, 50%)",
  "hsl(100, 50%, 45%)",
  "hsl(240, 50%, 60%)",
  "hsl(20, 70%, 55%)",
];

/**
 * Returns a deterministic color for a category name.
 * - Known expense/income categories get their fixed color.
 * - "Uncategorized" always returns gray.
 * - Unknown names get a stable fallback based on a simple hash so
 *   the same name always maps to the same color.
 */
export function getCategoryColor(name: string): string {
  if (!name || name.toLowerCase() === "uncategorized") return UNCATEGORIZED_COLOR;
  if (EXPENSE_CATEGORY_COLORS[name]) return EXPENSE_CATEGORY_COLORS[name];
  if (INCOME_CATEGORY_COLORS[name]) return INCOME_CATEGORY_COLORS[name];

  // Stable hash for unknown categories → consistent color across renders
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return FALLBACK_PALETTE[Math.abs(hash) % FALLBACK_PALETTE.length];
}
