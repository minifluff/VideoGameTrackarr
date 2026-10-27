import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useAppearance } from "../theme/AppearanceProvider";

// Mirrors the breakpoint -> column-count mapping the grid used before virtualization
// (Grid size={{ xs: 6, sm: 4, md: 3, lg: 2, xl: 2 }} => 2/3/4/6/6 columns).
const COLUMNS_BY_BREAKPOINT = { xs: 2, sm: 3, md: 4, lg: 6, xl: 6 } as const;

// When a page passes its own card size (its Options menu), that wins for this grid;
// otherwise the global appearance size applies.
export function useResponsiveColumns(cardSizeOverride?: number): number {
  const theme = useTheme();
  const { cardSize: globalCardSize } = useAppearance();
  const cardSize = cardSizeOverride ?? globalCardSize;
  const isSm = useMediaQuery(theme.breakpoints.up("sm"));
  const isMd = useMediaQuery(theme.breakpoints.up("md"));
  const isLg = useMediaQuery(theme.breakpoints.up("lg"));
  const isXl = useMediaQuery(theme.breakpoints.up("xl"));

  let base: number;
  if (isXl) base = COLUMNS_BY_BREAKPOINT.xl;
  else if (isLg) base = COLUMNS_BY_BREAKPOINT.lg;
  else if (isMd) base = COLUMNS_BY_BREAKPOINT.md;
  else if (isSm) base = COLUMNS_BY_BREAKPOINT.sm;
  else base = COLUMNS_BY_BREAKPOINT.xs;

  // cardSize 0.5 (small) => more columns, 2.0 (large) => fewer columns
  const adjusted = Math.round(base / cardSize);
  return Math.max(1, Math.min(12, adjusted));
}
