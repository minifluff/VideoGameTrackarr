import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import type { GameSummary } from "../api/types";
import { useGames } from "../hooks/useGames";
import { gameIdentifier } from "../utils/identifiers";
import GamesSubNav from "./GamesSubNav";

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

const BookshelfPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: games, isLoading } = useGames();
  const [search, setSearch] = useState("");

  const shelves = useMemo(() => buildShelves(games), [games]);
  const keyword = search.trim().toLowerCase();
  const visibleShelves = useMemo(() => {
    if (!keyword) return shelves;
    return shelves
      .map((shelf) => ({
        ...shelf,
        cases: shelf.cases.filter((entry) => entry.game.name.toLowerCase().includes(keyword)),
      }))
      .filter((shelf) => shelf.cases.length > 0);
  }, [shelves, keyword]);

  const totalCases = shelves.reduce((sum, shelf) => sum + shelf.cases.length, 0);

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
        <TextField
          size="small"
          placeholder={t("games.bookshelf.searchPlaceholder")}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </Stack>
      {isLoading ? (
        <Paper sx={{ p: 3, textAlign: "center" }}>{t("common.loading")}</Paper>
      ) : visibleShelves.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: "center" }}>{t("games.bookshelf.empty")}</Paper>
      ) : (
        visibleShelves.map((shelf) => (
          <Box key={shelf.platform} sx={{ mb: 4 }}>
            <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, mb: 1 }}>
              <Typography variant="h6" component="h2">
                {shelf.platform}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {shelf.cases.length}
              </Typography>
            </Box>
            <Box
              sx={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "flex-end",
                gap: "3px",
                px: 1,
              }}
            >
              {shelf.cases.map((entry) => {
                const style = spineStyle(entry.platform, entry.game.id);
                return (
                  <Box
                    key={`${entry.game.id}-${entry.platform}`}
                    component="button"
                    title={`${entry.game.name} — ${entry.platform}`}
                    onClick={() => navigate(`/game/${gameIdentifier(entry.game)}`)}
                    sx={{
                      width: style.width,
                      height: style.height,
                      p: 0,
                      border: "none",
                      borderRadius: "2px 2px 0 0",
                      cursor: "pointer",
                      overflow: "hidden",
                      position: "relative",
                      flexShrink: 0,
                      transition: "transform 120ms ease",
                      "&:hover": { transform: "translateY(-6px)" },
                      backgroundColor: style.background,
                      color: style.color,
                      boxShadow: "inset -3px 0 5px rgba(0,0,0,0.35), inset 2px 0 3px rgba(255,255,255,0.15)",
                    }}
                  >
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
                        py: 0.75,
                        height: "100%",
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
        ))
      )}
    </Box>
  );
};

export default BookshelfPage;
