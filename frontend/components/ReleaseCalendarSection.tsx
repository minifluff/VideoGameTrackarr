import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { useReleaseCalendar } from "../hooks/useDashboard";
import { useShareLink } from "../hooks/useShareLink";
import { gameIdentifier, hardwareIdentifier } from "../utils/identifiers";
import CardCarousel from "./CardCarousel";
import GameCard from "./GameCard";
import HardwareCard from "./HardwareCard";

interface ReleaseCalendarSectionProps {
  scope: "games" | "hardware";
  title: string;
}

const formatReleaseDate = (dateStr: string): string => {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
};

const ReleaseCalendarSection = ({ scope, title }: ReleaseCalendarSectionProps) => {
  const { t } = useTranslation();
  const { data, isLoading } = useReleaseCalendar();
  const navigate = useNavigate();
  const { data: shareToken } = useShareLink();

  if (isLoading) {
    return <Typography color="text.secondary">{t("releaseCalendar.loading")}</Typography>;
  }

  const releases = (data ?? []).filter((item) =>
    scope === "games" ? item.kind === "game" : item.kind !== "game"
  );

  if (releases.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        {t("releaseCalendar.empty", {
          itemType:
            scope === "games"
              ? t("releaseCalendar.itemTypeGame")
              : t("releaseCalendar.itemTypeHardware"),
        })}
      </Typography>
    );
  }

  return (
    <>
    {scope === "games" && shareToken && (
      <Button
        variant="contained"
        size="large"
        fullWidth
        sx={{ mb: 2, py: 1.5, fontSize: "1.1rem" }}
        onClick={() => navigate(`/public/${shareToken}/games`)}
      >
        {t("insights.dashboard.publicCollectionButton")}
      </Button>
    )}
    <CardCarousel
      items={releases}
      getItemKey={(item) =>
        item.kind === "game"
          ? `game-${item.game!.id}`
          : item.kind === "device"
            ? `device-${item.device!.id}`
            : `accessory-${item.accessory!.id}`
      }
      title={title}
      renderItem={(item) => {
        if (item.kind === "game" && item.game) {
          return (
            <Box>
              <GameCard
                game={item.game}
                context="list"
                contextFunction={() => navigate(`/game/${gameIdentifier(item.game!)}`)}
              />
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block", textAlign: "center", mt: 0.5, fontWeight: "bold" }}
              >
                {formatReleaseDate(item.releaseDate)}
              </Typography>
            </Box>
          );
        }
        if (item.kind === "device" && item.device) {
          return (
            <Box>
            <HardwareCard
              name={item.device.officialName}
              subtitle={[item.device.manufacturerName, item.device.hardwarePlatformName]
                .filter(Boolean)
                .join(" · ")}
              imageUrl={item.device.imageUrl}
              owned={item.device.owned}
              wishlisted={item.device.wishlisted}
              ownedQuantity={item.device.ownedQuantity}
              onClick={() =>
                navigate(
                  `/hardware/device/${hardwareIdentifier(item.device!.officialName, item.device!.uuid)}`
                )
              }
            />
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block", textAlign: "center", mt: 0.5, fontWeight: "bold" }}
              >
                {formatReleaseDate(item.releaseDate)}
              </Typography>
            </Box>
          );
        }
        if (item.kind === "accessory" && item.accessory) {
          return (
            <Box>
            <HardwareCard
              name={item.accessory.officialName}
              subtitle={[item.accessory.manufacturerName, item.accessory.accessoryTypeName]
                .filter(Boolean)
                .join(" · ")}
              imageUrl={item.accessory.imageUrl}
              owned={item.accessory.owned}
              wishlisted={item.accessory.wishlisted}
              ownedQuantity={item.accessory.ownedQuantity}
              onClick={() =>
                navigate(
                  `/hardware/accessory/${hardwareIdentifier(item.accessory!.officialName, item.accessory!.uuid)}`
                )
              }
            />
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block", textAlign: "center", mt: 0.5, fontWeight: "bold" }}
              >
                {formatReleaseDate(item.releaseDate)}
              </Typography>
            </Box>
          );
        }
        return null;
      }}
    />
    </>
  );
};

export default ReleaseCalendarSection;
