import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Box from "@mui/material/Box";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { resolveAssetUrl } from "../api/client";
import { listAllLibraryItems } from "../api/library";
import type { GameSummary, LibraryListItem, PlatformResponse } from "../api/types";
import { useGames } from "../hooks/useGames";
import { usePlatforms } from "../hooks/usePlatforms";
import { gameIdentifier } from "../utils/identifiers";
import GamesSubNav from "./GamesSubNav";
import PlatformTemplateDialog from "./PlatformTemplateDialog";
import SpineIconGlyph from "./SpineIcon";
import { caseSizeToPixels, effectiveCaseSizeMm } from "../utils/caseSizes";

export interface ShelfCase {
  game: GameSummary;
  platform: string;
}

export interface Shelf {
  platform: string;
  cases: ShelfCase[];
}

// One case per owned copy (game × owned platform) — the bookshelf shows what
// physically sits on the shelf, so a game owned on two platforms appears twice.
export function buildShelves(games: GameSummary[] | undefined): Shelf[] {
  const byPlatform = new Map<string, ShelfCase[]>();
  for (const game of games ?? []) {
    if (!game.owned) continue;
    for (const platform of game.ownedPlatforms) {
      const list = byPlatform.get(platform) ?? [];
      list.push({ game, platform });
      byPlatform.set(platform, list);
    }
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

// Shelf cases are keyed by the game summary's platform label (the IGDB
// abbreviation when there is one, e.g. "PS5"), while library items carry the
// full platform name ("PlayStation 5") — bridge the two through the platform
// catalogue so a case can find its copies' formats for the Format filter.
export function caseFormatsKey(gameId: number, platform: string) {
  return `${gameId}|${platform}`;
}

export function buildCaseFormats(
  items: LibraryListItem[] | undefined,
  platforms: PlatformResponse[] | undefined
): Map<string, Set<string>> {
  const keyByName = new Map((platforms ?? []).map((p) => [p.name, p.abbreviation ?? p.name]));
  const formats = new Map<string, Set<string>>();
  for (const item of items ?? []) {
    if (!item.format || !item.platformName) continue;
    const platform = keyByName.get(item.platformName) ?? item.platformName;
    const key = caseFormatsKey(item.gameId, platform);
    const set = formats.get(key) ?? new Set<string>();
    set.add(item.format);
    formats.set(key, set);
  }
  return formats;
}

// Blank spine art is platform-based, not per-game: every case on a platform
// shares the platform's brand colours — matched on platform-name substrings,
// with a stable palette fallback.
const PLATFORM_SPINE_STYLES: { match: RegExp; background: string; color: string; height: number }[] = [
  { match: /switch/, background: "#f2f2f2", color: "#e60012", height: 158 },
  { match: /playstation|ps[1-5]|vita/, background: "#1b3a8f", color: "#ffffff", height: 176 },
  { match: /xbox/, background: "#107c10", color: "#ffffff", height: 176 },
  { match: /gamecube/, background: "#5b3ea8", color: "#ffffff", height: 168 },
  { match: /wii/, background: "#f5f5f5", color: "#3aa6dd", height: 176 },
  { match: /nintendo|nes|snes|n64|game boy|gameboy|ds|virtual/, background: "#8f1d22", color: "#ffffff", height: 190 },
  { match: /sega|genesis|dreamcast|saturn|master system/, background: "#17569b", color: "#ffffff", height: 182 },
  { match: /pc|windows|steam|dos/, background: "#2a475e", color: "#c7d5e0", height: 182 },
  { match: /atari|commodore|amiga|zx|arcade/, background: "#5a4632", color: "#f5e9d0", height: 190 },
];
const FALLBACK_PALETTE = ["#37474f", "#4e342e", "#283593", "#00695c", "#6a1b9a", "#ad1457", "#4527a0", "#2e7d32"];

export function spineStyle(platform: string, gameId: number) {
  const key = platform.toLowerCase();
  const matched = PLATFORM_SPINE_STYLES.find((entry) => entry.match.test(key));
  const width = 24 + (gameId % 14);
  if (matched) {
    return { background: matched.background, color: matched.color, height: matched.height, width };
  }
  return {
    background: FALLBACK_PALETTE[gameId % FALLBACK_PALETTE.length],
    color: "#ffffff",
    height: 176,
    width,
  };
}

// What the shelf measures from a template image when it loads: its natural
// pixel size (cases are scaled from it) and whether it's mostly white (the
// case title then prints black instead of white).
export interface TemplateInfo {
  naturalWidth: number;
  naturalHeight: number;
  light: boolean;
}

// Mean per-pixel luminance of an RGBA sample; "mostly white" is a bright
// average, so a template that's white with a small dark logo still counts.
export function isMostlyWhite(rgba: ArrayLike<number>): boolean {
  let total = 0;
  let pixels = 0;
  for (let i = 0; i + 2 < rgba.length; i += 4) {
    total += (rgba[i] + rgba[i + 1] + rgba[i + 2]) / 3;
    pixels += 1;
  }
  return pixels > 0 && total / pixels >= 205;
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

// Readable title/icon colour over a user-picked spine colour: dark text on
// light colours, white on dark ones.
export function contrastTextColor(hex: string): string {
  const match = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!match) return "#ffffff";
  const value = parseInt(match[1], 16);
  const luminance =
    0.2126 * ((value >> 16) & 255) + 0.7152 * ((value >> 8) & 255) + 0.0722 * (value & 255);
  return luminance >= 150 ? "#161616" : "#ffffff";
}

export function caseSize(
  platform: string,
  gameId: number,
  templateSize?: { width: number; height: number }
): { width: number; height: number } {
  if (templateSize) return templateSize;
  const flat = spineStyle(platform, gameId);
  return { width: flat.width, height: flat.height };
}

export interface ShelfRowItem {
  kind: "bookend" | "case";
  platform: string;
  entry?: ShelfCase;
  width: number;
  height: number;
}

export const BOOKEND_WIDTH = 38;
const CASE_GAP = 3;

// Cases flow continuously across platforms — the next platform starts right
// where the previous one ended instead of forcing a new shelf. Rows are
// packed greedily against the measured shelf width so EVERY row sits on its
// own shelf board. A platform's bookend tile leads its first case and is
// never left orphaned at a row's end.
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

export function packRows(
  shelves: Shelf[],
  maxWidth: number,
  caseSizes?: Map<string, { width: number; height: number }>
): ShelfRowItem[][] {
  const items: ShelfRowItem[] = [];
  for (const shelf of shelves) {
    items.push({
      kind: "bookend",
      platform: shelf.platform,
      width: BOOKEND_WIDTH,
      height: spineStyle(shelf.platform, 0).height,
    });
    for (const entry of shelf.cases) {
      const size = caseSize(entry.platform, entry.game.id, caseSizes?.get(entry.platform));
      items.push({
        kind: "case",
        platform: shelf.platform,
        entry,
        width: size.width,
        height: size.height,
      });
    }
  }
  const rows: ShelfRowItem[][] = [];
  let row: ShelfRowItem[] = [];
  let rowWidth = 0;
  items.forEach((item, index) => {
    let needed = item.width;
    // A bookend must share its row with its platform's first case.
    if (item.kind === "bookend" && index + 1 < items.length) {
      needed += CASE_GAP + items[index + 1].width;
    }
    if (row.length > 0 && rowWidth + CASE_GAP + needed > maxWidth) {
      rows.push(row);
      row = [];
      rowWidth = 0;
    }
    if (row.length > 0) rowWidth += CASE_GAP;
    rowWidth += item.width;
    row.push(item);
  });
  if (row.length > 0) rows.push(row);
  return rows;
}

const BookshelfPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: games, isLoading } = useGames();
  const [search, setSearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [formatFilter, setFormatFilter] = useState("all");
  const [templatePlatform, setTemplatePlatform] = useState<PlatformResponse | null>(null);

  // Same data the Games List page's Platform/Format filters run on (shared
  // query cache with that page).
  const { data: items } = useQuery({ queryKey: ["library", "all-items"], queryFn: listAllLibraryItems });
  const { data: platforms } = usePlatforms();
  const caseFormats = useMemo(() => buildCaseFormats(items, platforms), [items, platforms]);
  const platformsByLabel = useMemo(() => indexPlatformsByLabel(platforms), [platforms]);
  // Each template image is measured when it loads: natural size (cases are
  // scaled proportionally from it, largest template sets the scale) and
  // whiteness (a mostly-white template gets black title text).
  const [templateInfo, setTemplateInfo] = useState<Map<string, TemplateInfo>>(new Map());
  useEffect(() => {
    for (const platform of platforms ?? []) {
      if (!platform.spineTemplateUrl) continue;
      const label = platform.abbreviation ?? platform.name;
      if (templateInfo.has(label)) continue;
      const image = new Image();
      image.onload = () => {
        if (image.naturalHeight <= 0) return;
        let light = false;
        try {
          const canvas = document.createElement("canvas");
          canvas.width = 16;
          canvas.height = 16;
          const context = canvas.getContext("2d");
          if (context) {
            context.drawImage(image, 0, 0, 16, 16);
            light = isMostlyWhite(context.getImageData(0, 0, 16, 16).data);
          }
        } catch {
          light = false;
        }
        const info: TemplateInfo = {
          naturalWidth: image.naturalWidth,
          naturalHeight: image.naturalHeight,
          light,
        };
        setTemplateInfo((previous) => {
          if (previous.has(label)) return previous;
          const next = new Map(previous);
          next.set(label, info);
          return next;
        });
      };
      image.src = resolveAssetUrl(platform.spineTemplateUrl) ?? platform.spineTemplateUrl;
    }
  }, [platforms, templateInfo]);
  const formatOptions = useMemo(
    () => [...new Set([...caseFormats.values()].flatMap((set) => [...set]))].sort(),
    [caseFormats]
  );

  const shelves = useMemo(() => buildShelves(games), [games]);
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
      shelves
        .filter((shelf) => platformFilter === "all" || shelf.platform === platformFilter)
        .map((shelf) => ({
          ...shelf,
          cases: shelf.cases.filter((entry) => {
            if (keyword && !entry.game.name.toLowerCase().includes(keyword)) return false;
            if (
              formatFilter !== "all" &&
              !caseFormats.get(caseFormatsKey(entry.game.id, entry.platform))?.has(formatFilter)
            )
              return false;
            return true;
          }),
        }))
        .filter((shelf) => shelf.cases.length > 0),
    [shelves, keyword, platformFilter, formatFilter, caseFormats]
  );

  const totalCases = shelves.reduce((sum, shelf) => sum + shelf.cases.length, 0);

  // Rows are packed against the real shelf width (repacked on resize) so each
  // row of cases gets its own shelf board at any window size.
  const shelfRef = useRef<HTMLDivElement>(null);
  const [shelfWidth, setShelfWidth] = useState(1200);
  useEffect(() => {
    const element = shelfRef.current;
    if (!element) return;
    const update = () => setShelfWidth(element.clientWidth);
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const rows = useMemo(
    () => packRows(visibleShelves, Math.max(shelfWidth - 16, 200), platformCaseSizes),
    [visibleShelves, shelfWidth, platformCaseSizes]
  );

  return (
    <Box>
      <GamesSubNav />
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
        <Stack spacing={1.5} sx={{ width: "100%", flex: { sm: 1 }, maxWidth: { sm: 620 } }}>
          <TextField
            size="small"
            fullWidth
            placeholder={t("games.bookshelf.searchPlaceholder")}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <Stack direction="row" spacing={1.5}>
            <FormControl size="small" sx={{ flex: 1, minWidth: 0 }}>
              <InputLabel>{t("games.listPage.platformColumn")}</InputLabel>
              <Select
                value={platformFilter}
                label={t("games.listPage.platformColumn")}
                onChange={(event) => setPlatformFilter(event.target.value)}
              >
                <MenuItem value="all">{t("common.all")}</MenuItem>
                {shelves.map((shelf) => (
                  <MenuItem key={shelf.platform} value={shelf.platform}>
                    {shelf.platform}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ flex: 1, minWidth: 0 }}>
              <InputLabel>{t("games.listPage.formatColumn")}</InputLabel>
              <Select
                value={formatFilter}
                label={t("games.listPage.formatColumn")}
                onChange={(event) => setFormatFilter(event.target.value)}
              >
                <MenuItem value="all">{t("common.all")}</MenuItem>
                {formatOptions.map((format) => (
                  <MenuItem key={format} value={format}>
                    {format}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </Stack>
      </Stack>
      {isLoading ? (
        <Paper sx={{ p: 3, textAlign: "center" }}>{t("common.loading")}</Paper>
      ) : rows.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: "center" }}>{t("games.bookshelf.empty")}</Paper>
      ) : (
        <Box ref={shelfRef}>
          {rows.map((row, rowIndex) => (
            <Box key={rowIndex} sx={{ mb: 3 }}>
              <Box sx={{ display: "flex", alignItems: "flex-end", gap: "3px", px: 1 }}>
                {row.map((item) => {
                  if (item.kind === "bookend") {
                    const style = spineStyle(item.platform, 0);
                    const record = platformsByLabel.get(item.platform);
                    return (
                      <Box
                        key={`bookend-${item.platform}`}
                        component="button"
                        title={t("games.bookshelf.template.forPlatform", { platform: item.platform })}
                        onClick={() => record && setTemplatePlatform(record)}
                        sx={{
                          width: BOOKEND_WIDTH,
                          height: style.height,
                          flexShrink: 0,
                          p: 0,
                          cursor: "pointer",
                          border: "1px solid #000",
                          borderRadius: "2px 2px 0 0",
                          background: "linear-gradient(180deg, #2b2b2e 0%, #000000 100%)",
                          color: "#ffffff",
                          boxShadow:
                            "inset -3px 0 6px rgba(0,0,0,0.9), inset 2px 0 4px rgba(255,255,255,0.22), 0 0 0 1px rgba(0,0,0,0.55), 2px 0 6px rgba(0,0,0,0.45)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          transition: "transform 120ms ease",
                          "&:hover": { transform: "translateY(-6px)" },
                        }}
                      >
                        <Box
                          sx={{
                            writingMode: "vertical-rl",
                            transform: "rotate(180deg)",
                            fontSize: 12.5,
                            fontWeight: 800,
                            letterSpacing: 1.4,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            maxHeight: "100%",
                            py: 0.75,
                          }}
                        >
                          {item.platform}
                        </Box>
                      </Box>
                    );
                  }
                  const entry = item.entry!;
                  const style = spineStyle(entry.platform, entry.game.id);
                  const platformRecord = platformsByLabel.get(entry.platform);
                  const templateUrl = platformRecord?.spineTemplateUrl ?? null;
                  // Generic-spine styling: the platform's chosen colour wins
                  // over the brand colour, and its icon sits at the top.
                  const genericColor = !templateUrl ? platformRecord?.spineColor ?? null : null;
                  const showSpineIcon = !templateUrl;
                  const spineIconKey = platformRecord?.spineIcon ?? "logo";
                  const templateLight = templateUrl
                    ? (templateInfo.get(entry.platform)?.light ?? false)
                    : false;
                  return (
                    <Box
                      key={`${entry.game.id}-${entry.platform}`}
                      component="button"
                      title={`${entry.game.name} — ${entry.platform}`}
                      onClick={() => navigate(`/game/${gameIdentifier(entry.game)}`)}
                      sx={{
                        width: item.width,
                        height: item.height,
                        p: 0,
                        border: "none",
                        borderRadius: "2px 2px 0 0",
                        cursor: "pointer",
                        overflow: "hidden",
                        position: "relative",
                        flexShrink: 0,
                        transition: "transform 120ms ease",
                        "&:hover": { transform: "translateY(-6px)" },
                        backgroundColor: genericColor ?? style.background,
                        color: templateUrl
                          ? templateLight
                            ? "#161616"
                            : "#ffffff"
                          : genericColor
                            ? contrastTextColor(genericColor)
                            : style.color,
                        boxShadow: "inset -3px 0 5px rgba(0,0,0,0.35), inset 2px 0 3px rgba(255,255,255,0.15)",
                      }}
                    >
                      {templateUrl && (
                        <Box
                          component="img"
                          src={resolveAssetUrl(templateUrl) ?? undefined}
                          alt=""
                          sx={{
                            position: "absolute",
                            inset: 0,
                            width: "100%",
                            height: "100%",
                            // The case is sized to the template's aspect
                            // (see caseSize), so the image fills it exactly —
                            // scaled, never cropped, never stretched.
                            objectFit: "fill",
                            display: "block",
                          }}
                        />
                      )}
                      {showSpineIcon && (
                        <Box
                          sx={{
                            position: "absolute",
                            top: 4,
                            left: 0,
                            right: 0,
                            display: "flex",
                            justifyContent: "center",
                            pointerEvents: "none",
                          }}
                        >
                          <SpineIconGlyph
                            iconKey={spineIconKey}
                            slug={platformRecord?.slug}
                            iconUrl={platformRecord?.spineIconUrl}
                            size={Math.max(12, Math.min(22, Math.round(item.width * 0.72)))}
                          />
                        </Box>
                      )}
                      <Box
                        sx={{
                          writingMode: "vertical-rl",
                          transform: "rotate(180deg)",
                          fontSize: 10.5,
                          fontWeight: 600,
                          letterSpacing: 0.4,
                          lineHeight: 1.15,
                          maxHeight: "100%",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          mx: "auto",
                          // The title stays clear of the logo zones at both
                          // ends of the spine: the icon at the top (generic
                          // spines) / the art's own logos (templates), and a
                          // matching inset at the bottom.
                          pt: templateUrl ? 3 : showSpineIcon ? 4.75 : 2.5,
                          pb: templateUrl ? 3 : 2.5,
                          height: "100%",
                          position: "relative",
                          ...(templateUrl
                            ? {
                                textShadow: templateLight
                                  ? "0 1px 2px rgba(255,255,255,0.65), 0 0 5px rgba(255,255,255,0.5)"
                                  : "0 1px 3px rgba(0,0,0,0.95), 0 0 7px rgba(0,0,0,0.75)",
                              }
                            : {}),
                        }}
                      >
                        {entry.game.name}
                      </Box>
                    </Box>
                  );
                })}
              </Box>
              <Box
                sx={{
                  height: 14,
                  background: "linear-gradient(180deg, #8b5a2b 0%, #6f4520 55%, #59371a 100%)",
                  borderRadius: "0 0 4px 4px",
                  boxShadow: "0 6px 10px rgba(0,0,0,0.35)",
                }}
              />
            </Box>
          ))}
        </Box>
      )}
      <PlatformTemplateDialog platform={templatePlatform} onClose={() => setTemplatePlatform(null)} />
    </Box>
  );
};

export default BookshelfPage;
