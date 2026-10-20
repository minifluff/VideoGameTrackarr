import { useMemo, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Collapse from "@mui/material/Collapse";
import Paper from "@mui/material/Paper";
import Slider from "@mui/material/Slider";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import type { CatalogSortOption } from "../api/types";
import CatalogIndexToolbar from "./CatalogIndexToolbar";
import CatalogRefCard from "./CatalogRefCard";
import VirtualGameGrid from "./VirtualGameGrid";
import { useSessionState } from "../hooks/useSessionState";
import { useScrollCollapse } from "../hooks/useScrollCollapse";

interface CatalogIndexEntry {
  id: number;
  name: string;
  // Shown by the default CatalogRefCard (Collections/Series).
  coverUrls?: string[];
}

interface CatalogIndexGridProps<T extends CatalogIndexEntry> {
  title: string;
  description: string;
  emptyMessage: string;
  searchLabel: string;
  searchPlaceholder: string;
  entries: T[] | undefined;
  isLoading: boolean;
  getHref: (entry: T) => string;
  // Defaults to the entry's id; Platforms needs its own, since PC has a card per storefront.
  getKey?: (entry: T) => number | string;
  // What the "Most games" sort orders by.
  getCount: (entry: T) => number;
  // Defaults to a plain name + game count CatalogRefCard.
  renderCard?: (entry: T, onClick: () => void) => ReactNode;
  estimateRowHeight?: (columns: number) => number;
  // sessionStorage key for this page's remembered search/sort (see hooks/useSessionState.ts).
  stateKey: string;
  // Collections/Series only: a "more than N games" slider in the header's top-right
  // corner, hiding entries whose game count doesn't beat it. Platforms doesn't pass
  // this — a platform card is a storefront slice, so a count threshold means less there.
  showMinGamesFilter?: boolean;
}

// Shared by CollectionsPage, SeriesPage and PlatformsPage — same "index of catalog refs, each
// linking to its own browse page" shape, just a different data source, card and link target.
// Search and sort are purely client-side (the full list is already fetched with no
// pagination), unlike the Games list's server-side filtering — there's no comparable dataset
// size concern here.
const CatalogIndexGrid = <T extends CatalogIndexEntry>({
  title,
  description,
  emptyMessage,
  searchLabel,
  searchPlaceholder,
  entries,
  isLoading,
  getHref,
  getKey,
  getCount,
  renderCard,
  estimateRowHeight,
  stateKey,
  showMinGamesFilter = false,
}: CatalogIndexGridProps<T>) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const collapsed = useScrollCollapse();
  const [searchKeyword, setSearchKeyword] = useSessionState(`${stateKey}.searchKeyword`, "");
  const [sort, setSort] = useSessionState<CatalogSortOption>(`${stateKey}.sort`, "name_asc");
  // Defaults to 2: on a big library most collections/series have a game or two, and the
  // page is more useful opening on the substantial ones (3+ games).
  const [minGames, setMinGames] = useSessionState(`${stateKey}.minGames`, 2);

  const maxGameCount = useMemo(
    () => (entries ?? []).reduce((max, entry) => Math.max(max, getCount(entry)), 0),
    [entries, getCount]
  );

  const visibleEntries = useMemo(() => {
    if (!entries) return [];
    const trimmed = searchKeyword.trim().toLowerCase();
    let filtered = trimmed
      ? entries.filter((entry) => entry.name.toLowerCase().includes(trimmed))
      : entries;
    if (showMinGamesFilter) {
      filtered = filtered.filter((entry) => getCount(entry) > minGames);
    }
    const sorted = [...filtered].sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "name_desc") sorted.reverse();
    // Stable sort, so entries with the same count stay in name order.
    if (sort === "count_desc") sorted.sort((a, b) => getCount(b) - getCount(a));
    return sorted;
  }, [entries, searchKeyword, sort, getCount, showMinGamesFilter, minGames]);

  return (
    <>
      <Box
        sx={{
          position: "sticky",
          top: { xs: 56, sm: 64 },
          zIndex: (theme) => theme.zIndex.appBar - 1,
          backgroundColor: (theme) => theme.palette.background.default,
          pt: 1,
          pb: 1,
          mb: 2,
        }}
      >
        <Collapse in={!collapsed}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 2, mb: 2 }}>
            <Box>
              <Typography variant="h4" component="h1" gutterBottom>
                {title}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {description}
              </Typography>
            </Box>
            {showMinGamesFilter && entries && entries.length > 0 ? (
              <Box sx={{ width: { xs: 150, sm: 220 }, flexShrink: 0, pt: 1 }}>
                <Typography variant="caption" color="text.secondary" component="div" sx={{ textAlign: "right" }}>
                  {t("catalog.browseGrid.minGamesLabel", { count: minGames })}
                </Typography>
                <Slider
                  aria-label={t("catalog.browseGrid.minGamesLabel", { count: minGames })}
                  value={Math.min(minGames, maxGameCount)}
                  onChange={(_, value) => setMinGames(value as number)}
                  min={0}
                  max={maxGameCount}
                  step={1}
                  valueLabelDisplay="auto"
                  size="small"
                />
              </Box>
            ) : null}
          </Box>
        </Collapse>
        <CatalogIndexToolbar
          searchLabel={searchLabel}
          searchPlaceholder={searchPlaceholder}
          searchKeyword={searchKeyword}
          onSearchKeywordChange={setSearchKeyword}
          sort={sort}
          onSortChange={setSort}
        />
      </Box>
      {isLoading ? (
        <Paper sx={{ p: 3, textAlign: "center" }}>{t("common.loading")}</Paper>
      ) : !entries || entries.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: "center" }}>{emptyMessage}</Paper>
      ) : visibleEntries.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: "center" }}>{t("games.listToolbar.noSearchMatches")}</Paper>
      ) : (
        <VirtualGameGrid
          items={visibleEntries}
          getKey={getKey ?? ((entry) => entry.id)}
          // Defaults to VirtualGameGrid's own estimate, which fits CatalogRefCard's cover grid.
          estimateRowHeight={estimateRowHeight}
          renderItem={(entry) => {
            const onClick = () => navigate(getHref(entry));
            return renderCard ? (
              renderCard(entry, onClick)
            ) : (
              <CatalogRefCard
                name={entry.name}
                gameCount={getCount(entry)}
                coverUrls={entry.coverUrls ?? []}
                onClick={onClick}
              />
            );
          }}
        />
      )}
    </>
  );
};

export default CatalogIndexGrid;
