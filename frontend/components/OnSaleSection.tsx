import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { Trans, useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import type { OnSaleItem } from "../api/types";
import { useOnSale } from "../hooks/useInsights";
import { formatCurrency } from "../utils/currency";
import { gameIdentifier } from "../utils/identifiers";
import { isAddon } from "../utils/utils";
import GameCard from "./GameCard";

interface OnSaleSectionProps {
  limit?: number;
}

export const OnSaleTile = ({ item }: { item: OnSaleItem }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const addon = isAddon(item.game);

  return (
    <Box>
      <GameCard
        game={{ ...item.game, wishlisted: true, isOnSale: true }}
        context={addon ? "addon" : "list"}
        contextFunction={() =>
          navigate(`/${addon ? "addon" : "game"}/${gameIdentifier(item.game)}`)
        }
      />
      <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.75 }}>
        {/* GG.deals reports no discount %, so its rows carry currentCut: null — render the
            price without a cut rather than a misleading "-0%". */}
        {item.currentCut !== null && item.currentCut !== undefined
          ? t("insights.onSale.currentPriceLabel", {
              price: formatCurrency(item.currentPriceAmount, item.currentPriceCurrency ?? "USD"),
              shop: item.currentShopName ?? t("common.unknown"),
              cut: item.currentCut,
            })
          : t("insights.onSale.currentPriceNoCutLabel", {
              price: formatCurrency(item.currentPriceAmount, item.currentPriceCurrency ?? "USD"),
              shop: item.currentShopName ?? t("common.unknown"),
            })}
      </Typography>
      {item.historicalLowAmount !== null && (
        <Typography variant="caption" color="text.secondary" component="div">
          {t("insights.onSale.historicalLowLabel", {
            price: formatCurrency(item.historicalLowAmount, item.historicalLowCurrency ?? "USD"),
          })}
        </Typography>
      )}
      {item.targetPrice !== null && (
        <Stack
          direction="row"
          spacing={0.5}
          sx={{ alignItems: "center", flexWrap: "wrap", mt: 0.25 }}
        >
          <Typography variant="caption" color="text.secondary">
            {t("insights.onSale.targetPriceLabel", {
              price: formatCurrency(item.targetPrice, item.currentPriceCurrency ?? "USD"),
            })}
          </Typography>
          {item.isTargetHit && (
            <Chip size="small" color="success" label={t("insights.onSale.targetHitLabel")} />
          )}
        </Stack>
      )}
    </Box>
  );
};

const OnSaleSection = ({ limit }: OnSaleSectionProps) => {
  const { t } = useTranslation();
  const { data: items } = useOnSale();
  const visibleItems = limit ? (items ?? []).slice(0, limit) : (items ?? []);

  if (!items || items.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        {t("insights.onSale.noneFound")}
      </Typography>
    );
  }

  return (
    // Fixed 16px gap at every breakpoint, matching VirtualGameGrid/CardCarousel's own
    // GRID_GAP_PX — keeps this grid's card width consistent with every other GameCard surface,
    // not just its own column counts.
    <>
      <Grid container spacing={2}>
        {visibleItems.map((item) => (
          <Grid key={item.libraryItemId} size={{ xs: 6, sm: 4, md: 3, lg: 2 }}>
            <OnSaleTile item={item} />
          </Grid>
        ))}
      </Grid>
      {/* GG.deals' API terms require crediting GG.deals with an active hyperlink wherever
          its price data is displayed — shown only when GG.deals rows are actually present. */}
      {visibleItems.some((item) => item.currentShopName === "GG.deals") && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
          <Trans
            i18nKey="insights.onSale.ggdealsAttribution"
            components={{
              1: <Link href="https://gg.deals" target="_blank" rel="noopener noreferrer" />,
            }}
          />
        </Typography>
      )}
    </>
  );
};

export default OnSaleSection;
