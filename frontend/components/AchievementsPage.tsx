import { useState } from "react";
import RefreshIcon from "@mui/icons-material/Refresh";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
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
import {
  useRetroAchievementsStatus,
  useRetroAchievementsSummary,
} from "../hooks/useAchievements";

// RetroAchievements timestamps are naive "YYYY-MM-DD HH:MM:SS" (UTC on their side).
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

const AchievementsPage = () => {
  const { t, i18n } = useTranslation();
  const { data: status, isLoading: statusLoading } = useRetroAchievementsStatus();
  const {
    data: summary,
    isLoading: summaryLoading,
    isError: summaryError,
    error,
    refresh,
  } = useRetroAchievementsSummary(status?.configured === true);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
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

  // Own system, separate from games — but it needs a RetroAchievements account
  // first. The username and key live on the Integrations page, like the Steam ID.
  if (!status?.configured) {
    return (
      <>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            {t("nav.achievements")}
          </Typography>
        </Box>
        <Card sx={{ maxWidth: 640 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              {t("achievements.notConfiguredTitle")}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {t("achievements.notConfiguredDescription")}
            </Typography>
            <Button component={RouterLink} to="/settings/integrations" variant="contained">
              {t("achievements.goToIntegrations")}
            </Button>
          </CardContent>
        </Card>
      </>
    );
  }

  const profile = summary?.profile;

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
          disabled={refreshing || summaryLoading}
        >
          {t("common.refresh")}
        </Button>
      </Box>

      {summaryLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 6 }}>
          <CircularProgress />
        </Box>
      ) : summaryError ? (
        <Alert severity="error">
          {errorDetail(error) ?? t("achievements.loadError")}
        </Alert>
      ) : (
        profile && (
          <>
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
                <Stack direction="row" spacing={3} sx={{ flexWrap: "wrap", rowGap: 0.5 }}>
                  <Typography variant="body2">
                    <Box component="span" sx={{ fontWeight: 600 }}>
                      {profile.totalPoints.toLocaleString()}
                    </Box>{" "}
                    {t("achievements.hardcorePoints")}
                  </Typography>
                  <Typography variant="body2">
                    <Box component="span" sx={{ fontWeight: 600 }}>
                      {profile.totalSoftcorePoints.toLocaleString()}
                    </Box>{" "}
                    {t("achievements.softcorePoints")}
                  </Typography>
                </Stack>
              </CardContent>
            </Card>

            <Typography variant="h5" component="h2" sx={{ mb: 1.5 }}>
              {t("achievements.recentlyPlayed")}
            </Typography>
            <Card sx={{ mb: 3 }}>
              {summary.recentlyPlayed.length === 0 ? (
                <CardContent>
                  <Typography variant="body2" color="text.secondary">
                    {t("achievements.noRecentlyPlayed")}
                  </Typography>
                </CardContent>
              ) : (
                <List disablePadding>
                  {summary.recentlyPlayed.map((game, index) => {
                    const total = game.numPossibleAchievements;
                    const percent = total > 0 ? (game.numAchieved / total) * 100 : 0;
                    return (
                      <Box key={game.gameId}>
                        {index > 0 && <Divider component="li" />}
                        <ListItem
                          component={RouterLink}
                          to={`/achievements/game/${game.gameId}`}
                          sx={{ py: 1.5 }}
                        >
                          <ListItemAvatar>
                            <Avatar
                              variant="square"
                              src={game.imageIconUrl ?? game.imageBoxArtUrl ?? undefined}
                              alt={game.title}
                              sx={{ width: 48, height: 48 }}
                            />
                          </ListItemAvatar>
                          <ListItemText
                            primary={game.title}
                            secondary={game.consoleName}
                            sx={{ minWidth: 0, mr: 2 }}
                          />
                          <Box sx={{ width: { xs: 120, sm: 220 }, flexShrink: 0 }}>
                            <LinearProgress
                              variant="determinate"
                              value={percent}
                              sx={{ mb: 0.5 }}
                            />
                            <Typography variant="body2" color="text.secondary">
                              {t("achievements.progress", {
                                achieved: game.numAchieved,
                                total,
                                score: game.scoreAchieved,
                              })}
                            </Typography>
                            {game.lastPlayed && (
                              <Typography variant="body2" color="text.secondary">
                                {formatRADate(game.lastPlayed, i18n.language)}
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
          </>
        )
      )}
    </>
  );
};

export default AchievementsPage;
