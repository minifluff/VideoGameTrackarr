import type { SyntheticEvent } from "react";
import Box from "@mui/material/Box";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import SaleTrackedPage from "./SaleTrackedPage";
import { IgnoredPanel, UntrackedPanel } from "./SalesIgnoredListPage";

// One page for all three sale lists, same shape as the Integration Sync page: the tab
// lives in the URL (?tab=tracked|ignored|untracked) so a tab is deep-linkable and the
// back button steps between tabs. Tracked first, then Ignored, then Untracked; each
// panel keeps its own table and pagination, only its heading is hidden, since this
// page already titles itself.
const SaleManagerPage = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const tab = tabParam === "ignored" || tabParam === "untracked" ? tabParam : "tracked";

  const handleTabChange = (_event: SyntheticEvent, next: string) => {
    setSearchParams({
      tab: next === "ignored" || next === "untracked" ? next : "tracked",
    });
  };

  return (
    <>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          {t("nav.saleManager")}
        </Typography>
      </Box>
      <Tabs value={tab} onChange={handleTabChange} aria-label={t("nav.saleManager")} sx={{ mb: 2 }}>
        <Tab value="tracked" label={t("insights.saleTracked.tabTracked")} />
        <Tab value="ignored" label={t("insights.salesIgnored.tabIgnored")} />
        <Tab value="untracked" label={t("insights.salesIgnored.tabUntracked")} />
      </Tabs>
      {tab === "tracked" ? (
        <SaleTrackedPage hideHeading />
      ) : tab === "ignored" ? (
        <IgnoredPanel />
      ) : (
        <UntrackedPanel />
      )}
    </>
  );
};

export default SaleManagerPage;
