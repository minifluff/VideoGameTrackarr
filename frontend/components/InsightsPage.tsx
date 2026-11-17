import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import {
  useAccessoriesWithoutOwnedHardware,
  useDuplicateLibraryItems,
  useMissingAddons,
  useOnSale,
} from "../hooks/useInsights";
import GameStatsSection from "./GameStatsSection";
import HardwareStatsSection from "./HardwareStatsSection";
import { StatTile, TileGrid } from "./Stats";

const InsightsPage = () => {
  const { t } = useTranslation();
  const { data: missingAddons } = useMissingAddons();
  const { data: duplicates } = useDuplicateLibraryItems();
  const { data: orphans } = useAccessoriesWithoutOwnedHardware();
  const { data: onSale } = useOnSale();

  const subPages = [
    { to: "/insights/missing-addons", label: t("nav.missingAddons"), value: missingAddons?.length },
    { to: "/insights/duplicates", label: t("nav.duplicates"), value: duplicates?.length },
    { to: "/insights/orphaned-accessories", label: t("nav.orphanedAccessories"), value: orphans?.length },
    { to: "/insights/on-sale", label: t("nav.onSale"), value: onSale?.length },
  ];

  return (
    <>
      <Typography variant="h5" component="h2" gutterBottom>
        {t("insights.page.gamesHeading")}
      </Typography>
      <GameStatsSection />

      <Divider sx={{ my: 3 }} />

      <Typography variant="h5" component="h2" gutterBottom>
        {t("insights.page.hardwareHeading")}
      </Typography>
      <HardwareStatsSection />

      <Divider sx={{ my: 3 }} />

      <Typography variant="h5" component="h2" gutterBottom>
        {t("insights.page.moreHeading")}
      </Typography>
      <TileGrid>
        {subPages.map((page) => (
          <StatTile key={page.to} label={page.label} value={page.value ?? "–"} to={page.to} quiet={page.value === 0} />
        ))}
      </TileGrid>
    </>
  );
};

export default InsightsPage;
