import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  Link,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";
import { useMemo } from "react";
import { Link as RouterLink, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { RAGameAchievement } from "../api/achievements";
import { useRetroAchievementsGameProgress } from "../hooks/useAchievements";

// RetroAchievements timestamps are naive "YYYY-MM-DD HH:MM:SS" (UTC on their side).
function parseRADate(value: string | null): number {
  if (!value) return 0;
  const parsed = new Date(`${value.replace(" ", "T")}Z`);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function formatRADate(value: string | null, language: string): string {
  if (!value) return "";
  const parsed = new Date(`${value.replace(" ", "T")}Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  // Format in UTC so the displayed calendar date is the date RA reports (the
  // RA app shows the raw UTC date); formatting in local time would shift
  // near-midnight unlocks to the previous day for western timezones.
  return parsed.toLocaleDateString(language, { dateStyle: "medium", timeZone: "UTC" });
}

function errorDetail(error: unknown): string | null {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (error as { response?: { data?: { detail?: unknown } } }).response;
    if (typeof response?.data?.detail === "string") return response.data.detail;
  }
  return null;
}

const AchievementGamePage = () => {
  const { t, i18n } = useTranslation();
  const { gameId } = useParams();
  const {
    data: progress,
    isLoading,
    isError,
    error,
  } = useRetroAchievementsGameProgress(gameId);

  // Unlocked first, most recently unlocked first (like the RA app), then the
  // locked ones in the game's own display order.
  const sortedAchievements = useMemo(() => {
    if (!progress) return [];
    const unlocked = progress.achievements.filter((a) => a.dateEarned);
    const locked = progress.achievements.filter((a) => !a.dateEarned);
    unlocked.sort((a, b) => parseRADate(b.dateEarned) - parseRADate(a.dateEarned));
    locked.sort((a, b) => a.displayOrder - b.displayOrder);
    return [...unlocked, ...locked];
  }, [progress]);

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (isError || !progress) {
    return (
      <>
        <Box sx={{ mb: 3 }}>
          <Button
            component={RouterLink}
            to="/achievements"
            startIcon={<ArrowBackIcon />}
            variant="text"
          >
            {t("achievements.game.backToAchievements")}
          </Button>
        </Box>
        <Alert severity="error">
          {errorDetail(error) ?? t("achievements.loadError")}
        </Alert>
      </>
    );
  }

  return (
    <>
      <Box sx={{ mb: 3 }}>
        <Button
          component={RouterLink}
          to="/achievements"
          startIcon={<ArrowBackIcon />}
          variant="text"
        >
          {t("achievements.game.backToAchievements")}
        </Button>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
            <Avatar
              variant="square"
              src={progress.imageIconUrl ?? progress.imageBoxArtUrl ?? undefined}
              alt={progress.title}
              sx={{ width: 96, height: 96 }}
            />
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h5" component="h1">
                {progress.title}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {progress.consoleName}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t("achievements.game.achievementsCount", {
                  achieved: progress.numAchieved,
                  total: progress.numPossibleAchievements,
                })}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t("achievements.game.pointsCount", {
                  achieved: progress.scoreAchieved,
                  total: progress.possibleScore,
                })}
              </Typography>
              <Link
                href={`https://retroachievements.org/game/${progress.gameId}`}
                target="_blank"
                rel="noreferrer"
                variant="body2"
                underline="hover"
              >
                {t("achievements.game.viewOnRetroAchievements")}
              </Link>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      <Typography variant="h5" component="h2" sx={{ mb: 1.5 }}>
        {t("nav.achievements")}
      </Typography>
      <Card>
        {sortedAchievements.length === 0 ? (
          <CardContent>
            <Typography variant="body2" color="text.secondary">
              {t("achievements.game.noAchievements")}
            </Typography>
          </CardContent>
        ) : (
          <List disablePadding>
            {sortedAchievements.map((achievement: RAGameAchievement, index: number) => {
              const unlocked = Boolean(achievement.dateEarned);
              return (
                <Box key={achievement.achievementId}>
                  {index > 0 && <Divider component="li" />}
                  <ListItem
                    sx={{
                      py: 1.5,
                      alignItems: "flex-start",
                      ...(unlocked ? {} : { opacity: 0.55 }),
                    }}
                  >
                    <ListItemAvatar>
                      <Avatar
                        variant="square"
                        src={achievement.badgeUrl ?? undefined}
                        alt={achievement.title}
                        sx={{
                          width: 40,
                          height: 40,
                          ...(unlocked ? {} : { filter: "grayscale(1)" }),
                        }}
                      />
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Typography component="span" sx={{ fontWeight: 500 }}>
                          {achievement.title}
                        </Typography>
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
                          {unlocked ? (
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              component="span"
                              sx={{ display: "block" }}
                            >
                              {t("achievements.game.unlockedOn", {
                                date: formatRADate(achievement.dateEarned, i18n.language),
                              })}
                            </Typography>
                          ) : (
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              component="span"
                              sx={{ display: "block" }}
                            >
                              {t("achievements.game.notUnlocked")}
                            </Typography>
                          )}
                          <Typography variant="body2" color="text.secondary" component="span">
                            {t("achievements.game.pointsLabel", { count: achievement.points })}
                          </Typography>
                        </>
                      }
                      sx={{ minWidth: 0, mr: 2 }}
                    />
                  </ListItem>
                </Box>
              );
            })}
          </List>
        )}
      </Card>
    </>
  );
};

export default AchievementGamePage;
