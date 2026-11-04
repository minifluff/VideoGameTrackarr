import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updatePreferences } from "../api/auth";
import type { FilterFieldSetting } from "../api/types";
import { currentUserQueryKey, useCurrentUser } from "./useAuth";

// Every field of the Games filter dialog, in the default order — the order the dialog
// showed before customisation existed. Adding a field here is enough: a saved layout
// that doesn't mention it yet gets it in its default place (see resolveFilterLayout).
// "toggles" is the Show-missing / Include-addons switch pair, which shares one grid cell.
export const FILTER_FIELD_KEYS = [
  "toggles",
  "gameType",
  "tags",
  "genres",
  "gameModes",
  "ownership",
  "playStatus",
  "platforms",
  "formats",
  "storefronts",
  "collections",
  "franchises",
  "steelbookOnly",
] as const;

export type FilterFieldKey = (typeof FILTER_FIELD_KEYS)[number];

export interface FilterField {
  key: FilterFieldKey;
  hidden: boolean;
}

export const DEFAULT_FILTER_LAYOUT: FilterField[] = FILTER_FIELD_KEYS.map((key) => ({
  key,
  hidden: false,
}));

const isFieldKey = (key: string): key is FilterFieldKey =>
  (FILTER_FIELD_KEYS as readonly string[]).includes(key);

// The saved layout made safe to render — same contract as resolveOverviewLayout:
// unknown keys (from a newer version) and repeats are dropped, and fields it doesn't
// mention (added in a later version) go back in after the field that precedes them by
// default, so they show up where they'd normally be.
export function resolveFilterLayout(
  saved: FilterFieldSetting[] | null | undefined
): FilterField[] {
  if (!saved?.length) return DEFAULT_FILTER_LAYOUT;
  const layout: FilterField[] = [];
  for (const entry of saved) {
    if (isFieldKey(entry.key) && !layout.some((field) => field.key === entry.key)) {
      layout.push({ key: entry.key, hidden: Boolean(entry.hidden) });
    }
  }
  FILTER_FIELD_KEYS.forEach((key, defaultIndex) => {
    if (layout.some((field) => field.key === key)) return;
    const previous = FILTER_FIELD_KEYS.slice(0, defaultIndex).reverse();
    const after = previous
      .map((prev) => layout.findIndex((field) => field.key === prev))
      .find((index) => index >= 0);
    layout.splice(after === undefined ? 0 : after + 1, 0, { key, hidden: false });
  });
  return layout;
}

// The Games filter dialog's field order and visibility, kept on the account like the
// Dashboard layout so every browser shows the same dialog.
export function useFilterLayout() {
  const queryClient = useQueryClient();
  const { data: user, isLoading: userLoading } = useCurrentUser();
  const layout = useMemo(() => resolveFilterLayout(user?.filterLayout), [user?.filterLayout]);
  const save = useMutation({
    mutationFn: (next: { layout: FilterField[] }) =>
      updatePreferences({ filterLayout: next.layout }),
    onSuccess: (updated) => queryClient.setQueryData(currentUserQueryKey, updated),
  });
  return { layout, save, userLoading };
}
