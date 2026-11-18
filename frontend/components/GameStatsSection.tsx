import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import type { MediaFormat, PlayStatus } from "../api/types";
import { useDashboardStats } from "../hooks/useDashboard";
import { useGenres } from "../hooks/useGenres";
import { useOpenFilteredGames } from "../hooks/useOpenFilteredGames";
import { usePlatforms } from "../hooks/usePlatforms";
import { BarList, PanelGrid, StatPanel, StatTile, TileGrid, formatPlaytime, type BarRow } from "./Stats";

const BAR_LIMIT = 10;

// Games half of Insights' stats — the upstream page's tiles and bar-list breakdowns.
// The tiles and the play-status/platform/genre/format rows open the filtered Games list.
const GameStatsSection = () => {
  const { t } = useTranslation();
  const { data: stats, isLoading } = useDashboardStats();
  const { data: platforms } = usePlatforms();
  const { data: genres } = useGenres();
  const openGames = useOpenFilteredGames();

  if (isLoading) {
    return <Typography color="text.secondary">{t("games.stats.loading")}</Typography>;
  }

  if (!stats) {
    return null;
  }

  const playStatusLabels: Record<PlayStatus, string> = {
    none: t("games.stats.playStatusNotStarted"),
    backlog: t("games.stats.playStatusBacklog"),
    playing: t("games.stats.playStatusPlaying"),
    completed: t("games.stats.playStatusCompleted"),
    abandoned: t("games.stats.playStatusAbandoned"),
  };
  const byCount = (a: BarRow, b: BarRow) => b.value - a.value || a.label.localeCompare(b.label);

  const playStatusRows: BarRow[] = Object.entries(stats.playStatusBreakdown)
    .map(([status, count]) => ({
      label: playStatusLabels[status as PlayStatus],
      value: count ?? 0,
      onClick: () => openGames({ playStatuses: [status as PlayStatus] }),
    }))
    .sort(byCount);
  const platformRows: BarRow[] = stats.platformBreakdown.map((entry) => {
    const platform = platforms?.find((option) => option.name === entry.name);
    return {
      label: entry.name,
      value: entry.count,
      onClick: platform ? () => openGames({ platformIds: [platform.id] }) : undefined,
    };
  });
  // Genre and platform rows resolve by name, like the platform rows — a name the
  // lookup doesn't know stays a plain row instead of a dead link.
  const genreRows: BarRow[] = stats.genreBreakdown.map((entry) => {
    const genre = genres?.find((option) => option.name === entry.name);
    return {
      label: entry.name,
      value: entry.count,
      onClick: genre ? () => openGames({ genreIds: [genre.id] }) : undefined,
    };
  });
  const formatLabels: Record<MediaFormat, string> = {
    physical: t("games.library.formatPhysical"),
    digital: t("games.library.formatDigital"),
    iso: t("games.library.formatIso"),
    rom: t("games.library.formatRom"),
    abandonware: t("games.library.formatAbandonware"),
    subscription: t("games.library.formatSubscription"),
    other: t("games.library.formatOther"),
  };
  const formatRows: BarRow[] = stats.formatBreakdown.map((entry) => ({
    label: formatLabels[entry.name as MediaFormat],
    value: entry.count,
    onClick: () => openGames({ formats: [entry.name as MediaFormat] }),
  }));

  const bars = (rows: BarRow[]) => (
    <BarList rows={rows} empty={t("insights.page.noData")} limit={BAR_LIMIT} otherLabel={t("insights.page.other")} />
  );

  return (
    <Stack spacing={3}>
      <TileGrid>
        <StatTile
          label={t("games.stats.ownedLabel")}
          value={stats.totalOwned}
          onClick={() => openGames({ ownershipStatuses: ["owned"] })}
        />
        <StatTile
          label={t("games.stats.wishlistedLabel")}
          value={stats.totalWishlisted}
          onClick={() => openGames({ ownershipStatuses: ["wishlisted"] })}
        />
        <StatTile label={t("games.stats.totalTrackedLabel")} value={stats.totalTracked} />
        <StatTile label={t("games.stats.playtimeLoggedLabel")} value={formatPlaytime(stats.totalPlaytimeMinutes, t)} />
        <StatTile
          label={t("games.stats.averageRatingLabel")}
          value={stats.averageRating === null ? "–" : stats.averageRating.toFixed(1)}
        />
      </TileGrid>
      <PanelGrid>
        <StatPanel title={t("games.stats.byPlayStatusTitle")}>{bars(playStatusRows)}</StatPanel>
        <StatPanel title={t("games.stats.byPlatformTitle")}>{bars(platformRows)}</StatPanel>
        <StatPanel title={t("games.stats.byGenreTitle")}>{bars(genreRows)}</StatPanel>
        <StatPanel title={t("games.stats.byFormatTitle")}>{bars(formatRows)}</StatPanel>
      </PanelGrid>
    </Stack>
  );
};

export default GameStatsSection;
