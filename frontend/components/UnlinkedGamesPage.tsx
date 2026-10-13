import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import GameList from "./GameList";
import InsightsSubNav from "./InsightsSubNav";

const UnlinkedGamesPage = () => {
  const { t } = useTranslation();

  return (
    <GameList
      sessionPrefix="unlinkedGames"
      forcedFilters={{ unlinkedOnly: true }}
      subNav={<InsightsSubNav />}
      header={
        <Box sx={{ mb: 2 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            {t("nav.unlinkedGames")}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t("insights.unlinkedGames.description")}
          </Typography>
        </Box>
      }
    />
  );
};

export default UnlinkedGamesPage;
