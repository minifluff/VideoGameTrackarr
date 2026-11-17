import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import type { PlayStatus } from "../api/types";
import { useDashboardStats } from "../hooks/useDashboard";
import { useOpenFilteredGames } from "../hooks/useOpenFilteredGames";
import { usePlatforms } from "../hooks/usePlatforms";
import { BarList, PanelGrid, StatPanel, StatTile, TileGrid, formatPlaytime, type BarRow } from "./Stats";

const BAR_LIMIT = 10;

// Games half of Insights' stats — the upstream page's tiles and bar-list breakdowns. The
// tiles and the play-status/platform rows open the filtered Games list; the genre rows
// don't (the Games list has no genre filter to open).
const GameStatsSection = () => {
  const { t } = useTranslation();
  const { data: stats, isLoading } = useDashboardStats();
  const { data: platforms } = usePlatforms();
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
  const plainRows = (entries: { name: string; count: number }[]): BarRow[] =>
    entries.map((entry) => ({ label: entry.name, value: entry.count }));

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
        <StatPanel title={t("games.stats.byGenreTitle")}>{bars(plainRows(stats.genreBreakdown))}</StatPanel>
      </PanelGrid>
    </Stack>
  );
};

export default GameStatsSection;
