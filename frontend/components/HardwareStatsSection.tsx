import Stack from "@mui/material/Stack";
import { useTranslation } from "react-i18next";
import { useHardwareStats } from "../hooks/useHardwareStats";
import { useCurrency } from "../theme/CurrencyProvider";
import { formatCurrency } from "../utils/currency";
import { BarList, PanelGrid, StatPanel, StatTile, TileGrid, type BarRow } from "./Stats";

const BAR_LIMIT = 10;

// Hardware half of Insights' stats — the upstream page's tiles and bar-list breakdowns.
const HardwareStatsSection = () => {
  const { t } = useTranslation();
  const { data: stats, isLoading } = useHardwareStats();
  const { currency } = useCurrency();

  if (isLoading || !stats) {
    return null;
  }

  const plainRows = (entries: { name: string; count: number }[]): BarRow[] =>
    entries.map((entry) => ({ label: entry.name, value: entry.count }));

  const bars = (rows: BarRow[]) => (
    <BarList rows={rows} empty={t("insights.page.noData")} limit={BAR_LIMIT} otherLabel={t("insights.page.other")} />
  );

  return (
    <Stack spacing={2} sx={{ mb: 3 }}>
      <TileGrid>
        <StatTile label={t("hardware.stats.ownedConsoles")} value={stats.ownedConsoles} to="/hardware" />
        <StatTile label={t("hardware.stats.ownedAccessories")} value={stats.ownedAccessories} to="/hardware" />
        <StatTile label={t("hardware.stats.wishlistHardware")} value={stats.wishlistHardware} to="/hardware" />
        <StatTile
          label={t("hardware.stats.collectionValue")}
          value={formatCurrency(stats.collectionValue, currency, { maximumFractionDigits: 0 })}
        />
      </TileGrid>
      <PanelGrid>
        <StatPanel title={t("hardware.stats.byManufacturer")}>{bars(plainRows(stats.manufacturerDistribution))}</StatPanel>
        <StatPanel title={t("hardware.stats.byPlatform")}>{bars(plainRows(stats.platformDistribution))}</StatPanel>
      </PanelGrid>
    </Stack>
  );
};

export default HardwareStatsSection;
