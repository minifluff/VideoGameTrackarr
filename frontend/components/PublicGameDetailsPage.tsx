import { Link, useParams } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { isAxiosError } from "axios";
import { useTranslation } from "react-i18next";
import { usePublicGame } from "../hooks/usePublic";
import GameAboutSection from "./GameAboutSection";
import GameCoverCard from "./GameCoverCard";
import NotFoundPage from "./NotFoundPage";

const sectionCardSx = { borderRadius: 2, overflow: "hidden" } as const;

// The share page's read-only take on GameDetails: the cover and About section only. Tags,
// Your Library, Addons, Progress and Notes are left out on purpose — the backend doesn't
// send that data here (see PublicGameDetailResponse).
const PublicGameDetailsPage = () => {
  const { t } = useTranslation();
  const { token, gameId: gameIdParam } = useParams<{ token: string; gameId: string }>();
  const gameId = Number(gameIdParam);
  const { data: game, isLoading, error } = usePublicGame(token, gameId);
  const gamesPath = `/public/${token}/games`;

  if (!Number.isFinite(gameId) || (isAxiosError(error) && error.response?.status === 404)) {
    return (
      <NotFoundPage
        title={t("errors.gameNotFoundTitle")}
        message={t("errors.notFoundMessage")}
        actionLabel={t("errors.backTo", { page: t("public.nav.games") })}
        actionTo={gamesPath}
      />
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        {t("public.games.loadError")}
      </Alert>
    );
  }

  if (isLoading || !game) {
    return (
      <Stack sx={{ alignItems: "center", py: 6 }}>
        <CircularProgress />
      </Stack>
    );
  }

  const formatLabel = (format: string | null) => {
    if (!format) return "—";
    const key = `library.format.${format}`;
    const translated = t(key);
    return translated === key ? format.charAt(0).toUpperCase() + format.slice(1) : translated;
  };

  return (
    <Grid container spacing={{ xs: 2, md: 3 }} sx={{ alignItems: "flex-start" }}>
      <Grid size={{ xs: 12, md: 3 }}>
        <Stack spacing={2}>
          {/* Sale tracking is the owner's own data, and the public list never shows "Missing". */}
          <GameCoverCard game={{ ...game, isOnSale: false, autoDiscovered: false }} />
          {game.ownedPlatforms.length > 0 && (
            <Box>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                {t("public.games.ownedOn")}
              </Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                {game.ownedPlatforms.map((platform) => (
                  <Chip key={platform} label={platform} size="small" />
                ))}
              </Box>
            </Box>
          )}
          <Button
            component={Link}
            to={gamesPath}
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            fullWidth
          >
            {t("errors.backTo", { page: t("public.nav.games") })}
          </Button>
        </Stack>
      </Grid>
      <Grid size={{ xs: 12, md: 9 }}>
        <Card sx={sectionCardSx}>
          <GameAboutSection game={game} publicToken={token} />
        </Card>
      </Grid>
      <Grid size={{ xs: 12 }}>
        <Card sx={sectionCardSx}>
          <Box sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              {t("public.games.collectionTitle")}
            </Typography>
            {game.ownedCopies.length > 0 ? (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>{t("public.games.collectionPlatform")}</TableCell>
                      <TableCell>{t("public.games.collectionEdition")}</TableCell>
                      <TableCell>{t("public.games.collectionFormat")}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {game.ownedCopies.map((copy, index) => (
                      <TableRow key={index}>
                        <TableCell>{copy.platform ?? "—"}</TableCell>
                        <TableCell>{copy.edition ?? "—"}</TableCell>
                        <TableCell>{formatLabel(copy.format)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Typography variant="body2" color="text.secondary">
                {t("public.games.collectionEmpty")}
              </Typography>
            )}
          </Box>
        </Card>
      </Grid>
    </Grid>
  );
};

export default PublicGameDetailsPage;
