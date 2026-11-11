import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import AlbumIcon from "@mui/icons-material/Album";
import CheckIcon from "@mui/icons-material/Check";
import SportsEsportsIcon from "@mui/icons-material/SportsEsports";
import TuneIcon from "@mui/icons-material/Tune";
import Badge from "@mui/material/Badge";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Slider from "@mui/material/Slider";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { fetchBookshelfEntries } from "../api/games";
import type { BookshelfEntry, PlatformResponse } from "../api/types";
import { usePlatforms } from "../hooks/usePlatforms";
import { gameIdentifier } from "../utils/identifiers";
import BookshelfGrid, { packRows, useProgressiveRows, useShelfWidth, useTemplateInfo } from "./BookshelfGrid";
import type { Shelf, ShelfCase, ShelfGame, TemplateInfo } from "./BookshelfGrid";
import PlatformTemplateDialog from "./PlatformTemplateDialog";
import { caseSizeToPixels, effectiveCaseSizeMm } from "../utils/caseSizes";

// The spine/shelf primitives live in BookshelfGrid (shared with the public
// shelf page); re-exported here so existing imports keep working.
export {
  BOOKEND_WIDTH,
  caseSize,
  contrastTextColor,
  packRows,
  spineStyle,
  TITLE_BOTTOM_INSET,
  TITLE_TOP_INSET,
  titleBandLight,
} from "./BookshelfGrid";
export type { ShelfRowItem } from "./BookshelfGrid";

// One case per owned (game x platform) entry — the bookshelf shows what
// physically sits on the shelf, so a game owned on two platforms appears twice.
export function buildShelvesFromEntries(entries: BookshelfEntry[] | undefined): Shelf[] {
  const byPlatform = new Map<string, ShelfCase[]>();
  for (const entry of entries ?? []) {
    const game: ShelfGame = {
      id: entry.gameId,
      name: entry.name,
      slug: entry.gameSlug,
      uuid: entry.gameUuid,
    };
    const list = byPlatform.get(entry.platformLabel) ?? [];
    list.push({ game, platform: entry.platformLabel });
    byPlatform.set(entry.platformLabel, list);
  }
  return [...byPlatform.entries()]
    .map(([platform, cases]) => ({
      platform,
      cases: cases.sort((a, b) => a.game.name.localeCompare(b.game.name)),
    }))
    .sort((a, b) => a.platform.localeCompare(b.platform));
}

// Shelf platforms are labelled by abbreviation when IGDB has one ("PS5"),
// else the full name — index the platform catalogue by that same label so a
// divider or case can find its platform record (template, id, ...).
export function indexPlatformsByLabel(
  platforms: PlatformResponse[] | undefined
): Map<string, PlatformResponse> {
  return new Map((platforms ?? []).map((p) => [p.abbreviation ?? p.name, p]));
}

// The platform filter's label: full name with the short label in parentheses
// ("PlayStation 5 (PS5)"). Shelves are keyed by the short label alone, so the full
// name comes from the catalogue; a label with no catalogue entry (or no
// abbreviation) renders as-is.
export function platformFilterLabel(
  platformsByLabel: Map<string, PlatformResponse>,
  shelfLabel: string
): string {
  const platform = platformsByLabel.get(shelfLabel);
  if (platform?.abbreviation) return `${platform.name} (${platform.abbreviation})`;
  return shelfLabel;
}

// Each case's copy formats, for the Format filter — the slim endpoint
// already resolved the platform label and merged duplicate copies' formats.
export function caseFormatsKey(gameId: number, platform: string) {
  return `${gameId}|${platform}`;
}

export function buildCaseFormatsFromEntries(
  entries: BookshelfEntry[] | undefined
): Map<string, Set<string>> {
  const formats = new Map<string, Set<string>>();
  for (const entry of entries ?? []) {
    if (entry.formats.length === 0) continue;
    formats.set(caseFormatsKey(entry.gameId, entry.platformLabel), new Set(entry.formats));
  }
  return formats;
}

// Templated cases share ONE scale, set by the largest template ON THE SHELF:
// the tallest of those renders at TEMPLATE_TARGET_HEIGHT and the others
// scale proportionally to it, keeping their true relative sizes. Two guards
// keep pixel dimensions from wrecking the shelf: templates for platforms
// with no cases here don't set the scale (one huge stray scan can't shrink
// everything), and the proportional shrink is floored at MIN_TEMPLATE_RATIO
// so no case renders tiny — widths always follow the same factor, so the
// aspect stays exact and nothing is ever cropped or stretched.
export const TEMPLATE_TARGET_HEIGHT = 190;
export const MIN_TEMPLATE_RATIO = 0.6;
export function buildTemplateCaseSizes(
  info: Map<string, TemplateInfo>,
  targetHeight: number = TEMPLATE_TARGET_HEIGHT,
  shelfLabels?: Set<string>
): Map<string, { width: number; height: number }> {
  const sizes = new Map<string, { width: number; height: number }>();
  const included = [...info.entries()].filter(([label]) => !shelfLabels || shelfLabels.has(label));
  let largest = 0;
  for (const [, template] of included) {
    largest = Math.max(largest, template.naturalHeight);
  }
  if (largest <= 0) return sizes;
  for (const [label, template] of included) {
    const ratio = Math.max(template.naturalHeight / largest, MIN_TEMPLATE_RATIO);
    const height = targetHeight * ratio;
    sizes.set(label, {
      width: Math.max(1, Math.round(height * (template.naturalWidth / template.naturalHeight))),
      height: Math.max(1, Math.round(height)),
    });
  }
  return sizes;
}

// The fixed size a platform's cases render at, in priority order: the
// platform's ACTUAL physical case size at 40% (user-chosen or the known size
// for the system) beats the template-proportional size. Platforms with
// neither get no entry and keep their varied flat spines.
export function resolvePlatformCaseSizes(
  labels: string[],
  platformsByLabel: Map<string, PlatformResponse>,
  templateSizes: Map<string, { width: number; height: number }>
): Map<string, { width: number; height: number }> {
  const sizes = new Map<string, { width: number; height: number }>();
  for (const label of labels) {
    const record = platformsByLabel.get(label);
    const actual = record ? effectiveCaseSizeMm(record) : null;
    if (actual) {
      sizes.set(label, caseSizeToPixels(actual.heightMm, actual.spineMm));
    } else if (templateSizes.has(label)) {
      sizes.set(label, templateSizes.get(label)!);
    }
  }
  return sizes;
}

export type ShelfSortField = "name" | "platform";
export type ShelfSortDirection = "asc" | "desc";

export function sortShelfCases(
  cases: ShelfCase[],
  field: ShelfSortField,
  direction: ShelfSortDirection
): ShelfCase[] {
  const sorted = [...cases];
  sorted.sort((a, b) =>
    field === "platform"
      ? a.platform.localeCompare(b.platform) || a.game.name.localeCompare(b.game.name)
      : a.game.name.localeCompare(b.game.name)
  );
  if (direction === "desc") sorted.reverse();
  return sorted;
}

export interface VisibleShelvesOptions {
  keyword: string;
  platformFilter: string;
  formatFilter: string;
  caseFormats: Map<string, Set<string>>;
  sortField: ShelfSortField;
  sortDirection: ShelfSortDirection;
  mixed: boolean;
}

// Search + filters + sort + grouping as one pure step, so the shelf math
// stays testable without rendering: grouped shelves keep their platform
// order (reversed for a platform-desc sort); "mixed" merges every visible
// case into a single ungrouped run.
export function buildVisibleShelves(shelves: Shelf[], options: VisibleShelvesOptions): Shelf[] {
  const { keyword, platformFilter, formatFilter, caseFormats, sortField, sortDirection, mixed } =
    options;
  const filtered = shelves
    .filter((shelf) => platformFilter === "all" || shelf.platform === platformFilter)
    .map((shelf) => ({
      ...shelf,
      cases: sortShelfCases(
        shelf.cases.filter((entry) => {
          if (keyword && !entry.game.name.toLowerCase().includes(keyword)) return false;
          if (
            formatFilter !== "all" &&
            !caseFormats.get(caseFormatsKey(entry.game.id, entry.platform))?.has(formatFilter)
          )
            return false;
          return true;
        }),
        sortField,
        sortDirection
      ),
    }))
    .filter((shelf) => shelf.cases.length > 0);
  if (sortField === "platform") {
    filtered.sort((a, b) =>
      sortDirection === "desc"
        ? b.platform.localeCompare(a.platform)
        : a.platform.localeCompare(b.platform)
    );
  }
  if (!mixed) return filtered;
  const allCases = sortShelfCases(
    filtered.flatMap((shelf) => shelf.cases),
    sortField,
    sortDirection
  );
  return allCases.length > 0 ? [{ platform: "", cases: allCases }] : [];
}

// Display preferences persist across visits (localStorage, like the
// appearance settings) — the shelf is a view, not a filter session.
const BOOKSHELF_CASE_SCALE_KEY = "vgt.bookshelfCaseScale";
const BOOKSHELF_MIXED_KEY = "vgt.bookshelfMixed";

function readStoredCaseScale(): number {
  const parsed = parseFloat(localStorage.getItem(BOOKSHELF_CASE_SCALE_KEY) ?? "");
  return !isNaN(parsed) && parsed >= 0.5 && parsed <= 2.0 ? parsed : 1.0;
}

function readStoredMixed(): boolean {
  return localStorage.getItem(BOOKSHELF_MIXED_KEY) === "true";
}

const BookshelfPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  // One slim request (owned game x platform rows) instead of the full games
  // list + every library item — the shelf was the slowest page to load.
  const { data: entries, isLoading } = useQuery({
    queryKey: ["bookshelf-entries"],
    queryFn: fetchBookshelfEntries,
    staleTime: 5 * 60 * 1000,
  });
  const [search, setSearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [formatFilter, setFormatFilter] = useState("all");
  const [templatePlatform, setTemplatePlatform] = useState<PlatformResponse | null>(null);
  const [caseScale, setCaseScaleState] = useState<number>(readStoredCaseScale);
  const [mixed, setMixedState] = useState<boolean>(readStoredMixed);
  const [optionsMenuAnchor, setOptionsMenuAnchor] = useState<HTMLElement | null>(null);
  const [platformMenuAnchor, setPlatformMenuAnchor] = useState<HTMLElement | null>(null);
  const [formatMenuAnchor, setFormatMenuAnchor] = useState<HTMLElement | null>(null);

  const setCaseScale = (scale: number) => {
    const clamped = Math.max(0.5, Math.min(2.0, scale));
    setCaseScaleState(clamped);
    localStorage.setItem(BOOKSHELF_CASE_SCALE_KEY, String(clamped));
  };

  const setMixed = (next: boolean) => {
    setMixedState(next);
    localStorage.setItem(BOOKSHELF_MIXED_KEY, String(next));
  };

  const { data: platforms } = usePlatforms();
  const caseFormats = useMemo(() => buildCaseFormatsFromEntries(entries), [entries]);
  const platformsByLabel = useMemo(() => indexPlatformsByLabel(platforms), [platforms]);
  const templateInfo = useTemplateInfo(platforms);
  const formatOptions = useMemo(
    () => [...new Set([...caseFormats.values()].flatMap((set) => [...set]))].sort(),
    [caseFormats]
  );

  const shelves = useMemo(() => buildShelvesFromEntries(entries), [entries]);
  const totalCases = shelves.reduce((sum, shelf) => sum + shelf.cases.length, 0);
  const keyword = search.trim().toLowerCase();
  const templateCaseSizes = useMemo(
    () => buildTemplateCaseSizes(templateInfo, TEMPLATE_TARGET_HEIGHT, new Set(shelves.map((s) => s.platform))),
    [templateInfo, shelves]
  );
  const platformCaseSizes = useMemo(
    () =>
      resolvePlatformCaseSizes(
        shelves.map((s) => s.platform),
        platformsByLabel,
        templateCaseSizes
      ),
    [shelves, platformsByLabel, templateCaseSizes]
  );
  const visibleShelves = useMemo(
    () =>
      buildVisibleShelves(shelves, {
        keyword,
        platformFilter,
        formatFilter,
        caseFormats,
        sortField: "name",
        sortDirection: "asc",
        mixed,
      }),
    [shelves, keyword, platformFilter, formatFilter, caseFormats, mixed]
  );



  // Rows are packed against the real shelf width (repacked on resize) so each
  // row of cases gets its own shelf board at any window size. The shelf only
  // renders once the entries arrive, so the width is measured whenever the
  // shelf element (re)mounts — see useShelfWidth in BookshelfGrid.
  const { shelfRef, shelfWidth } = useShelfWidth();
  const rows = useMemo(
    () =>
      packRows(visibleShelves, Math.max(shelfWidth - 16, 200), platformCaseSizes, {
        mixed,
        caseScale,
      }),
    [visibleShelves, shelfWidth, platformCaseSizes, mixed, caseScale]
  );

  // Rows render in capped chunks (see useProgressiveRows): painting ~7,000
  // cases at once was the other half of the slow load. The first chunk
  // paints fast and the rest load automatically as the user scrolls — no
  // button to tap. A new filter/search starts over.
  const { visibleRows, sentinelRef, hasMore } = useProgressiveRows(rows, visibleShelves);

  return (
    <Box>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ alignItems: { sm: "center" }, justifyContent: "space-between", mb: 1 }}
      >
        <Box>
          <Typography variant="h4" component="h1">
            {t("games.bookshelf.title")}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t("games.bookshelf.summary", { cases: totalCases })}
          </Typography>
        </Box>
        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: "center", width: "100%", flex: { sm: 1 }, maxWidth: { sm: 620 } }}
        >
          <TextField
            size="small"
            fullWidth
            placeholder={t("games.bookshelf.searchPlaceholder")}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <Tooltip title={t("games.listToolbar.optionsButton")}>
            <IconButton
              onClick={(event) => setOptionsMenuAnchor(event.currentTarget)}
              aria-label={t("games.listToolbar.optionsButton")}
              aria-haspopup="menu"
              aria-expanded={optionsMenuAnchor !== null}
              sx={{ alignSelf: "center" }}
            >
              <TuneIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title={t("games.listPage.platformColumn")}>
            <IconButton
              onClick={(event) => setPlatformMenuAnchor(event.currentTarget)}
              aria-label={t("games.listPage.platformColumn")}
              aria-haspopup="menu"
              aria-expanded={platformMenuAnchor !== null}
              sx={{ alignSelf: "center" }}
            >
              <Badge badgeContent={platformFilter !== "all" ? 1 : 0} color="primary">
                <SportsEsportsIcon />
              </Badge>
            </IconButton>
          </Tooltip>
          <Tooltip title={t("games.listPage.formatColumn")}>
            <IconButton
              onClick={(event) => setFormatMenuAnchor(event.currentTarget)}
              aria-label={t("games.listPage.formatColumn")}
              aria-haspopup="menu"
              aria-expanded={formatMenuAnchor !== null}
              sx={{ alignSelf: "center" }}
            >
              <Badge badgeContent={formatFilter !== "all" ? 1 : 0} color="primary">
                <AlbumIcon />
              </Badge>
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>
      <Menu
        anchorEl={optionsMenuAnchor}
        open={optionsMenuAnchor !== null}
        onClose={() => setOptionsMenuAnchor(null)}
      >
        <Box sx={{ px: 2, py: 1.5, width: 240 }}>
          <Typography variant="subtitle2" gutterBottom>
            {t("games.bookshelf.caseSize.label")}
          </Typography>
          <Box sx={{ px: 1 }}>
            <Slider
              value={caseScale}
              onChange={(_event, value) => setCaseScale(value as number)}
              min={0.5}
              max={2.0}
              step={0.1}
              marks={[
                { value: 0.5, label: t("settings.appearance.cardSizeSmall") },
                { value: 1.0, label: t("settings.appearance.cardSizeMedium") },
                { value: 2.0, label: t("settings.appearance.cardSizeLarge") },
              ]}
              valueLabelDisplay="auto"
              valueLabelFormat={(value) => `${Math.round(value * 100)}%`}
              aria-label={t("games.bookshelf.caseSize.label")}
            />
          </Box>
          <Typography variant="caption" color="text.secondary">
            {t("games.listToolbar.cardSizePageNote")}
          </Typography>
          <Divider sx={{ my: 1.5 }} />
          <FormControlLabel
            control={
              <Switch checked={mixed} onChange={(event) => setMixed(event.target.checked)} />
            }
            label={t("games.bookshelf.mixed")}
          />
          <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
            {t("games.bookshelf.mixedHelp")}
          </Typography>
        </Box>
      </Menu>
      <Menu
        anchorEl={platformMenuAnchor}
        open={platformMenuAnchor !== null}
        onClose={() => setPlatformMenuAnchor(null)}
      >
        <MenuItem
          selected={platformFilter === "all"}
          onClick={() => {
            setPlatformFilter("all");
            setPlatformMenuAnchor(null);
          }}
        >
          <ListItemText>{t("common.all")}</ListItemText>
          {platformFilter === "all" ? (
            <CheckIcon fontSize="small" color="primary" sx={{ ml: 2 }} />
          ) : null}
        </MenuItem>
        {shelves.map((shelf) => {
          const selected = shelf.platform === platformFilter;
          return (
            <MenuItem
              key={shelf.platform}
              selected={selected}
              onClick={() => {
                setPlatformFilter(shelf.platform);
                setPlatformMenuAnchor(null);
              }}
            >
              <ListItemText>{platformFilterLabel(platformsByLabel, shelf.platform)}</ListItemText>
              {selected ? <CheckIcon fontSize="small" color="primary" sx={{ ml: 2 }} /> : null}
            </MenuItem>
          );
        })}
      </Menu>
      <Menu
        anchorEl={formatMenuAnchor}
        open={formatMenuAnchor !== null}
        onClose={() => setFormatMenuAnchor(null)}
      >
        <MenuItem
          selected={formatFilter === "all"}
          onClick={() => {
            setFormatFilter("all");
            setFormatMenuAnchor(null);
          }}
        >
          <ListItemText>{t("common.all")}</ListItemText>
          {formatFilter === "all" ? (
            <CheckIcon fontSize="small" color="primary" sx={{ ml: 2 }} />
          ) : null}
        </MenuItem>
        {formatOptions.map((format) => {
          const selected = format === formatFilter;
          return (
            <MenuItem
              key={format}
              selected={selected}
              onClick={() => {
                setFormatFilter(format);
                setFormatMenuAnchor(null);
              }}
            >
              <ListItemText>{format}</ListItemText>
              {selected ? <CheckIcon fontSize="small" color="primary" sx={{ ml: 2 }} /> : null}
            </MenuItem>
          );
        })}
      </Menu>
      {isLoading ? (
        <Paper sx={{ p: 3, textAlign: "center" }}>{t("common.loading")}</Paper>
      ) : rows.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: "center" }}>{t("games.bookshelf.empty")}</Paper>
      ) : (
        <Box ref={shelfRef}>
          <BookshelfGrid
            rows={visibleRows}
            platformsByLabel={platformsByLabel}
            templateInfo={templateInfo}
            onBookendClick={(record) => setTemplatePlatform(record)}
            onCaseClick={(game) => navigate(`/game/${gameIdentifier(game)}`)}
            sentinelRef={sentinelRef}
            hasMore={hasMore}
          />
        </Box>
      )}
      <PlatformTemplateDialog platform={templatePlatform} onClose={() => setTemplatePlatform(null)} />
    </Box>
  );
};

export default BookshelfPage;
