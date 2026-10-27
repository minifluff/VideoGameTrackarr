import { useState } from "react";
import Box from "@mui/material/Box";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import GameList from "./GameList";
import InsightsSubNav from "./InsightsSubNav";

const UnlinkedGamesPage = () => {
  const { t } = useTranslation();
  const [hideWithCoverArt, setHideWithCoverArt] = useState(true);

  return (
    <GameList
      sessionPrefix="unlinkedGames"
      forcedFilters={{ unlinkedOnly: true, hideWithCoverArt: hideWithCoverArt || undefined }}
      subNav={<InsightsSubNav />}
      header={
        <Box sx={{ mb: 2 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            {t("nav.unlinkedGames")}
          </Typography>
          <FormControlLabel
            control={
              <Checkbox
                checked={hideWithCoverArt}
                onChange={(e) => setHideWithCoverArt(e.target.checked)}
              />
            }
            label={t("insights.unlinkedGames.hideWithCoverArt")}
            sx={{ mt: 1 }}
          />
        </Box>
      }
    />
  );
};

export default UnlinkedGamesPage;
