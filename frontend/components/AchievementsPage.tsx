import { useMemo, useState } from "react";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import RefreshIcon from "@mui/icons-material/Refresh";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  LinearProgress,
  Link,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type {
  RARecentAchievement,
  RARecentlyPlayedGame,
  SteamRecentAchievement,
  SteamRecentlyPlayedGame,
} from "../api/achievements";
import {
  useRetroAchievementsStatus,
  useRetroAchievementsSummary,
  useSteamAchievementsSummary,
} from "../hooks/useAchievements";

// Both sources feed one merged feed. RA timestamps are naive "YYYY-MM-DD HH:MM:SS"
// (UTC on their side); Steam sends ISO-8601 — parse both to epoch ms for sorting.
function parseAchievementDate(value: string | null): number | null {
  if (!value) return null;
  const iso = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  const parsed = new Date(iso).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

function formatAchievementDate(value: string | null, language: string): string {
  const parsed = parseAchievementDate(value);
  if (parsed === null) return value ?? "";
  return new Date(parsed).toLocaleDateString(language, { dateStyle: "medium" });
}

function errorDetail(error: unknown): string | null {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (error as { response?: { data?: { detail?: unknown } } }).response;
    if (typeof response?.data?.detail === "string") return response.data.detail;
  }
  return null;
}

type AchievementSource = "ra" | "steam";

interface MergedGame {
  key: string;
  title: string;
  subtitle: string;
  imageUrl: string | null;
  linkUrl: string;
  achieved: number;
  total: number;
  // Steam has no points — only RA rows carry a score.
  score: number | null;
  lastPlayed: string | null;
  lastPlayedMs: number | null;
  source: AchievementSource;
}

interface MergedAchievement {
  key: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  gameLine: string;
  date: string | null;
  dateMs: number | null;
  points: number | null;
  hardcore: boolean;
  source: AchievementSource;
}

function mergeGames(
  raGames: RARecentlyPlayedGame[],
  steamGames: SteamRecentlyPlayedGame[],
): MergedGame[] {
  const games: MergedGame[] = raGames.map((game) => ({
    key: `ra-${game.gameId}`,
    title: game.title,
    subtitle: game.consoleName,
    imageUrl: game.imageBoxArtUrl ?? game.imageIconUrl,
    linkUrl: `https://retroachievements.org/game/${game.gameId}`,
    achieved: game.numAchieved,
    total: game.numPossibleAchievements,
    score: game.scoreAchieved,
    lastPlayed: game.lastPlayed,
    lastPlayedMs: parseAchievementDate(game.lastPlayed),
    source: "ra",
  }));
  for (const game of steamGames) {
    games.push({
      key: `steam-${game.appid}`,
      title: game.name,
      subtitle: "Steam",
      imageUrl: game.iconUrl,
      linkUrl: `https://store.steampowered.com/app/${game.appid}`,
      achieved: game.unlockedCount,
      total: game.totalCount,
      score: null,
      lastPlayed: game.lastPlayed,
      lastPlayedMs: parseAchievementDate(game.lastPlayed),
      source: "steam",
    });
  }
  games.sort((a, b) => (b.lastPlayedMs ?? -1) - (a.lastPlayedMs ?? -1));
  return games;
}

function mergeAchievements(
  raAchievements: RARecentAchievement[],
  steamAchievements: SteamRecentAchievement[],
): MergedAchievement[] {
  const achievements: MergedAchievement[] = raAchievements.map((achievement) => ({
    key: `ra-${achievement.achievementId}`,
    title: achievement.title,
    description: achievement.description,
    imageUrl: achievement.badgeUrl,
    gameLine: `${achievement.gameTitle} · ${achievement.consoleName}`,
    date: achievement.dateEarned,
    dateMs: parseAchievementDate(achievement.dateEarned),
    points: achievement.points,
    hardcore: achievement.hardcore,
    source: "ra",
  }));
  for (const achievement of steamAchievements) {
    achievements.push({
      key: `steam-${achievement.appid}-${achievement.apiname}`,
      title: achievement.displayName,
      description: achievement.description,
      imageUrl: achievement.iconUrl,
      gameLine: achievement.gameName,
      date: achievement.unlockedAt,
      dateMs: parseAchievementDate(achievement.unlockedAt),
      points: null,
      hardcore: false,
      source: "steam",
    });
  }
  achievements.sort((a, b) => (b.dateMs ?? -1) - (a.dateMs ?? -1));
  return achievements;
}

function SetupHintCard({ title, description }: { title: string; description: string }) {
  const { t } = useTranslation();
  return (
    <Card sx={{ maxWidth: 640, mb: 2 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {description}
        </Typography>
        <Button component={RouterLink} to="/settings/integrations" variant="contained">
          {t("achievements.goToIntegrations")}
        </Button>
      </CardContent>
    </Card>
  );
}

const AchievementsPage = () => {
  const { t, i18n } = useTranslation();
  const { data: status, isLoading: statusLoading } = useRetroAchievementsStatus();
  const raConfigured = status?.configured === true;
  const steamConfigured = status?.steamConfigured === true;
  const {
    data: raSummary,
    isLoading: raSummaryLoading,
    isError: raSummaryError,
    error: raError,
    refresh: refreshRa,
  } = useRetroAchievementsSummary(raConfigured);
  const {
    data: steamSummary,
    isLoading: steamSummaryLoading,
    isError: steamSummaryError,
    error: steamError,
    refresh: refreshSteam,
  } = useSteamAchievementsSummary(steamConfigured);
  const [refreshing, setRefreshing] = useState(false);

  const mergedGames = useMemo(
    () => mergeGames(raSummary?.recentlyPlayed ?? [], steamSummary?.games ?? []),
    [raSummary, steamSummary],
  );
  const mergedAchievements = useMemo(
    () =>
      mergeAchievements(
        raSummary?.recentAchievements ?? [],
        steamSummary?.recentAchievements ?? [],
      ),
    [raSummary, steamSummary],
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        raConfigured ? refreshRa() : Promise.resolve(),
        steamConfigured ? refreshSteam() : Promise.resolve(),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  if (statusLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  // Own system, separate from games — but it needs at least one source first.
  // The username and key live on the Integrations page, like the Steam ID.
  if (!raConfigured && !steamConfigured) {
    return (
      <>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            {t("nav.achievements")}
          </Typography>
        </Box>
        <SetupHintCard
          title={t("achievements.notConfiguredTitle")}
          description={t("achievements.notConfiguredDescription")}
        />
        <SetupHintCard
          title={t("achievements.steamNotConfiguredTitle")}
          description={t("achievements.steamNotConfiguredDescription")}
        />
      </>
    );
  }

  const profile = raSummary?.profile;
  const anySummaryLoading =
    (raConfigured && raSummaryLoading) || (steamConfigured && steamSummaryLoading);
  const hasAnyData = Boolean(raSummary || steamSummary);

  return (
    <>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mb: 3,
          gap: 2,
          flexWrap: "wrap",
        }}
      >
        <Typography variant="h4" component="h1">
          {t("nav.achievements")}
        </Typography>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={handleRefresh}
          disabled={refreshing || anySummaryLoading}
        >
          {t("common.refresh")}
        </Button>
      </Box>

      {raConfigured && raSummaryError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errorDetail(raError) ?? t("achievements.loadError")}
        </Alert>
      )}
      {steamConfigured && steamSummaryError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errorDetail(steamError) ?? t("achievements.steamLoadError")}
        </Alert>
      )}

      {!hasAnyData && anySummaryLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {raConfigured && profile && (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Stack direction="row" spacing={2} sx={{ alignItems: "center", mb: 2 }}>
                  <Avatar
                    src={profile.userPicUrl ?? undefined}
                    alt={profile.username}
                    sx={{ width: 64, height: 64 }}
                  />
                  <Box>
                    <Link
                      href={`https://retroachievements.org/user/${profile.username}`}
                      target="_blank"
                      rel="noreferrer"
                      variant="h5"
                      underline="hover"
                    >
                      {profile.username}
                    </Link>
                    {profile.motto && (
                      <Typography variant="body2" color="text.secondary">
                        {profile.motto}
                      </Typography>
                    )}
                    {profile.richPresence && (
                      <Typography variant="body2" color="text.secondary">
                        {profile.richPresence}
                      </Typography>
                    )}
                  </Box>
                </Stack>
                <Divider sx={{ mb: 2 }} />
                <Stack direction="row" spacing={4} sx={{ flexWrap: "wrap", rowGap: 1 }}>
                  <Box>
                    <Typography variant="h6">{profile.totalPoints.toLocaleString()}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t("achievements.totalPoints")}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="h6">{profile.totalTruePoints.toLocaleString()}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t("achievements.truePoints")}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="h6">
                      {formatAchievementDate(profile.memberSince, i18n.language)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t("achievements.memberSince")}
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          )}

          <Typography variant="h5" component="h2" sx={{ mb: 1.5 }}>
            {t("achievements.recentlyPlayed")}
          </Typography>
          <Card sx={{ mb: 3 }}>
            {mergedGames.length === 0 ? (
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  {t("achievements.noRecentlyPlayed")}
                </Typography>
              </CardContent>
            ) : (
              <List disablePadding>
                {mergedGames.map((game, index) => {
                  const total = game.total;
                  const percent = total > 0 ? (game.achieved / total) * 100 : 0;
                  return (
                    <Box key={game.key}>
                      {index > 0 && <Divider component="li" />}
                      <ListItem sx={{ py: 1.5 }}>
                        <ListItemAvatar>
                          <Avatar
                            variant="rounded"
                            src={game.imageUrl ?? undefined}
                            alt={game.title}
                            sx={{ width: 48, height: 48 }}
                          />
                        </ListItemAvatar>
                        <ListItemText
                          primary={
                            <Stack
                              direction="row"
                              spacing={1}
                              sx={{ alignItems: "center", flexWrap: "wrap" }}
                            >
                              <Link
                                href={game.linkUrl}
                                target="_blank"
                                rel="noreferrer"
                                underline="hover"
                              >
                                {game.title}
                              </Link>
                              <Chip
                                size="small"
                                variant="outlined"
                                label={t(
                                  game.source === "ra"
                                    ? "achievements.sourceRetroAchievements"
                                    : "achievements.sourceSteam",
                                )}
                              />
                            </Stack>
                          }
                          secondary={game.subtitle}
                          sx={{ minWidth: 0, mr: 2 }}
                        />
                        <Box sx={{ width: { xs: 120, sm: 220 }, flexShrink: 0 }}>
                          <LinearProgress
                            variant="determinate"
                            value={percent}
                            sx={{ mb: 0.5 }}
                          />
                          <Typography variant="body2" color="text.secondary">
                            {game.score !== null
                              ? t("achievements.progress", {
                                  achieved: game.achieved,
                                  total,
                                  score: game.score,
                                })
                              : t("achievements.progressNoScore", {
                                  achieved: game.achieved,
                                  total,
                                })}
                          </Typography>
                          {game.lastPlayed && (
                            <Typography variant="body2" color="text.secondary">
                              {formatAchievementDate(game.lastPlayed, i18n.language)}
                            </Typography>
                          )}
                        </Box>
                      </ListItem>
                    </Box>
                  );
                })}
              </List>
            )}
          </Card>

          <Typography variant="h5" component="h2" sx={{ mb: 1.5 }}>
            {t("achievements.recentAchievements")}
          </Typography>
          <Card sx={{ mb: 3 }}>
            {mergedAchievements.length === 0 ? (
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  {t("achievements.noRecentAchievements")}
                </Typography>
              </CardContent>
            ) : (
              <List disablePadding>
                {mergedAchievements.map((achievement, index) => (
                  <Box key={achievement.key}>
                    {index > 0 && <Divider component="li" />}
                    <ListItem sx={{ py: 1.5, alignItems: "flex-start" }}>
                      <ListItemAvatar>
                        <Avatar
                          variant="rounded"
                          src={achievement.imageUrl ?? undefined}
                          alt={achievement.title}
                          sx={{ width: 40, height: 40 }}
                        />
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Stack
                            direction="row"
                            spacing={1}
                            sx={{ alignItems: "center", flexWrap: "wrap" }}
                          >
                            <Typography component="span" sx={{ fontWeight: 500 }}>
                              {achievement.title}
                            </Typography>
                            {achievement.hardcore && (
                              <Chip
                                size="small"
                                color="warning"
                                icon={<EmojiEventsIcon />}
                                label={t("achievements.hardcore")}
                              />
                            )}
                            <Chip
                              size="small"
                              variant="outlined"
                              label={t(
                                achievement.source === "ra"
                                  ? "achievements.sourceRetroAchievements"
                                  : "achievements.sourceSteam",
                              )}
                            />
                          </Stack>
                        }
                        secondary={
                          <>
                            {achievement.description && (
                              <Typography
                                variant="body2"
                                color="text.secondary"
                                component="span"
                                sx={{ display: "block" }}
                              >
                                {achievement.description}
                              </Typography>
                            )}
                            <Typography variant="body2" color="text.secondary" component="span">
                              {achievement.gameLine}
                            </Typography>
                          </>
                        }
                        sx={{ minWidth: 0, mr: 2 }}
                      />
                      <Box sx={{ textAlign: "right", flexShrink: 0 }}>
                        {achievement.points !== null && (
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {t("achievements.points", { count: achievement.points })}
                          </Typography>
                        )}
                        {achievement.date && (
                          <Typography variant="body2" color="text.secondary">
                            {formatAchievementDate(achievement.date, i18n.language)}
                          </Typography>
                        )}
                      </Box>
                    </ListItem>
                  </Box>
                ))}
              </List>
            )}
          </Card>

          {!raConfigured && (
            <SetupHintCard
              title={t("achievements.notConfiguredTitle")}
              description={t("achievements.notConfiguredDescription")}
            />
          )}
          {!steamConfigured && (
            <SetupHintCard
              title={t("achievements.steamNotConfiguredTitle")}
              description={t("achievements.steamNotConfiguredDescription")}
            />
          )}
        </>
      )}
    </>
  );
};

export default AchievementsPage;
