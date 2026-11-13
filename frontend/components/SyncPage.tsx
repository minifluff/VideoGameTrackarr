import type { SyntheticEvent } from "react";
import { useSearchParams } from "react-router-dom";
import Box from "@mui/material/Box";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import GogSyncPage from "./GogSyncPage";
import SteamSyncPage from "./SteamSyncPage";

// One page for both store syncs, with Steam and GOG as tabs — the Add Game
// header, the sidebar and the Integrations page all land here, and the old
// /settings/steam-sync and /settings/gog-sync routes redirect here with the
// matching ?tab=. The tab lives in the URL so a tab is deep-linkable and the
// back button steps between tabs. Each panel keeps its own Import button and
// table; only its heading is hidden, since this page already titles itself.
const SyncPage = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") === "gog" ? "gog" : "steam";

  const handleTabChange = (_event: SyntheticEvent, next: string) => {
    setSearchParams({ tab: next === "gog" ? "gog" : "steam" });
  };

  return (
    <>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          {t("nav.integrationSync")}
        </Typography>
      </Box>
      <Tabs value={tab} onChange={handleTabChange} aria-label={t("nav.integrationSync")} sx={{ mb: 2 }}>
        <Tab value="steam" label={t("nav.steamTab")} />
        <Tab value="gog" label={t("nav.gogTab")} />
      </Tabs>
      {tab === "steam" ? <SteamSyncPage hideHeading /> : <GogSyncPage hideHeading />}
    </>
  );
};

export default SyncPage;
