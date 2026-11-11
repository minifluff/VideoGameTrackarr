import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardMedia from "@mui/material/CardMedia";
import Chip from "@mui/material/Chip";
import { useTheme } from "@mui/material/styles";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { resolveAssetUrl } from "../api/client";
import OwnershipBadges from "./OwnershipBadges";

interface HardwareCardProps {
  name: string;
  subtitle: string | null;
  imageUrl: string | null;
  owned: boolean;
  wishlisted: boolean;
  ownedQuantity: number;
  // Not linked to a hardware reference catalog entry: a "Custom" chip, styled like
  // GameCard's for a game with no IGDB link.
  isCustom?: boolean;
  // Optional so a read-only context (the public share-link view) can render a non-clickable
  // card without a dummy handler.
  onClick?: () => void;
  // Second line under the subtitle — the release calendar's date, rendered inside the
  // card instead of as a caption below it (upstream's shape).
  dateLine?: string;
}

// Shared by Hardware and Accessory grids — same shape of info (name, a one-line
// subtitle, owned/wishlist badges, a quantity chip) but neither maps cleanly onto
// GameCard's game-specific fields (release year, play status, addon type), so this is
// its own component rather than a GameCard reuse.
const HardwareCard = ({
  name,
  subtitle,
  imageUrl,
  owned,
  wishlisted,
  ownedQuantity,
  isCustom = false,
  onClick,
  dateLine,
}: HardwareCardProps) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isClickable = Boolean(onClick);

  return (
    <Card
      sx={{
        position: "relative",
        borderRadius: 2,
        border: `1px solid ${theme.palette.divider}`,
        width: "100%",
        height: "100%",
        overflow: "hidden",
        cursor: isClickable ? "pointer" : "default",
        transition: "transform 150ms ease, box-shadow 150ms ease",
        "&:hover": isClickable
          ? { transform: "translateY(-2px)", boxShadow: theme.shadows[6] }
          : { transform: "none", boxShadow: theme.shadows[1] },
      }}
      onClick={onClick}
    >
      <OwnershipBadges owned={owned} wishlisted={wishlisted} />

      <Box
        sx={{
          position: "relative",
          aspectRatio: "4 / 3",
          overflow: "hidden",
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        {imageUrl ? (
          <CardMedia
            component="img"
            alt={name}
            loading="lazy"
            image={resolveAssetUrl(imageUrl) ?? undefined}
            sx={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              bgcolor: "action.hover",
              color: "text.secondary",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              p: 2,
              textAlign: "center",
            }}
          >
            <Typography variant="caption">{t("hardware.card.noImage")}</Typography>
          </Box>
        )}
        {isCustom ? (
          // Bottom-left: the bottom-right corner is the quantity badge's. Colours match
          // GameCard's Custom chip.
          <Box
            component="span"
            sx={{
              position: "absolute",
              left: 7,
              bottom: 7,
              maxWidth: "calc(100% - 64px)",
              height: 22,
              px: 1,
              borderRadius: 999,
              bgcolor: "#5d6673",
              color: "#fff",
              fontSize: 11.5,
              fontWeight: 650,
              lineHeight: "22px",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              boxShadow: "0 0 0 1px rgba(255, 255, 255, 0.16)",
              pointerEvents: "none",
            }}
          >
            {t("hardware.card.customLabel")}
          </Box>
        ) : null}
      </Box>

      <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
        <Tooltip title={name}>
          <Typography
            variant="subtitle2"
            component="div"
            sx={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
          >
            <strong>{name}</strong>
          </Typography>
        </Tooltip>
        <Typography
          variant="caption"
          color="text.secondary"
          component="div"
          sx={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
        >
          {subtitle ?? " "}
        </Typography>
        {dateLine !== undefined ? (
          <Typography
            variant="caption"
            color="text.secondary"
            component="div"
            sx={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
          >
            {dateLine}
          </Typography>
        ) : null}
        {owned && ownedQuantity > 1 ? <Chip label={`x${ownedQuantity}`} size="small" sx={{ mt: 0.75 }} /> : null}
      </CardContent>
    </Card>
  );
};

export default HardwareCard;
