import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import { useTheme } from "@mui/material/styles";
import { useTranslation } from "react-i18next";
import type { LibraryHardwarePlatform } from "../api/types";
import { useLibraryHardwarePlatforms } from "../hooks/useHardwareLookups";
import { slugify } from "../utils/identifiers";
import { hardwarePlatformLogoUrl } from "../utils/platformLogos";
import CatalogIndexGrid from "./CatalogIndexGrid";
import { LogoOrBadge } from "./PlatformCard";

// Taller than a CatalogRefCard: each card has a logo area above the name and counts —
// same shape as Games → Platforms' cards, so the same row heights.
const PLATFORM_CARD_HEIGHT_BY_COLUMNS: Record<number, number> = {
  2: 170,
  3: 166,
  4: 162,
  6: 158,
};

// Games → Platforms' card for a hardware platform: its logo (or name, until one is added) in a
// short well, then how many devices and accessories it has.
const HardwarePlatformCard = ({ platform, onClick }: { platform: LibraryHardwarePlatform; onClick: () => void }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <Card
      sx={{
        borderRadius: 2,
        border: `1px solid ${theme.palette.divider}`,
        transition: "transform 150ms ease, box-shadow 150ms ease",
        "&:hover": { transform: "translateY(-2px)", boxShadow: theme.shadows[6] },
      }}
    >
      <CardActionArea onClick={onClick}>
        <Box
          sx={{
            height: 72,
            px: 1.5,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: "action.hover",
          }}
        >
          <LogoOrBadge logoUrl={hardwarePlatformLogoUrl(platform.name)} badgeText={platform.name} height={56} />
        </Box>
        <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
          <Typography
            variant="subtitle2"
            component="div"
            title={platform.name}
            sx={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
          >
            <strong>{platform.name}</strong>
          </Typography>
          {/* Always both lines, so every card is the same height (VirtualGameGrid measures one
              card and assumes the rest match). */}
          <Typography variant="caption" color="text.secondary" component="div" noWrap>
            {t("hardware.platformsPage.deviceCount", { count: platform.deviceCount })}
          </Typography>
          <Typography variant="caption" color="text.secondary" component="div" noWrap>
            {t("hardware.platformsPage.accessoryCount", { count: platform.accessoryCount })}
          </Typography>
        </CardContent>
      </CardActionArea>
    </Card>
  );
};

// Hardware → Platforms: every hardware platform with devices or accessories you own or want,
// each linking to its own page of them (like Games → Platforms).
const HardwarePlatformsPage = () => {
  const { t } = useTranslation();
  const { data: platforms, isLoading } = useLibraryHardwarePlatforms();

  return (
    <CatalogIndexGrid
      stateKey="hardwarePlatforms"
      title={t("hardware.platformsPage.title")}
      emptyMessage={t("hardware.platformsPage.emptyMessage")}
      searchLabel={t("games.platformsPage.searchLabel")}
      searchPlaceholder={t("games.platformsPage.searchPlaceholder")}
      entries={platforms}
      isLoading={isLoading}
      getHref={(entry) => `/hardware/platforms/${slugify(entry.name)}`}
      getCount={(entry) => entry.deviceCount + entry.accessoryCount}
      renderCard={(entry, onClick) => <HardwarePlatformCard platform={entry} onClick={onClick} />}
      estimateRowHeight={(columns) => PLATFORM_CARD_HEIGHT_BY_COLUMNS[columns] ?? 164}
    />
  );
};

export default HardwarePlatformsPage;
