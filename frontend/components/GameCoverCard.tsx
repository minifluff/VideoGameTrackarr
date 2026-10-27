import { useState } from "react";
import CloseIcon from "@mui/icons-material/Close";
import ImageNotSupportedOutlinedIcon from "@mui/icons-material/ImageNotSupportedOutlined";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardMedia from "@mui/material/CardMedia";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import IconButton from "@mui/material/IconButton";
import { useTheme } from "@mui/material/styles";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { resolveAssetUrl } from "../api/client";
import type { GameDetail } from "../api/types";
import OwnershipBadges from "./OwnershipBadges";

// Stored IGDB covers are t_720p (sharp enough for every card size the app renders),
// but a fullscreen view is bigger than any card — so an IGDB cover is re-requested at
// t_1080p there. Any other URL (uploads, local-network links) passes through untouched.
const fullSizeCoverUrl = (url: string | null): string | null => {
  if (!url || !url.includes("images.igdb.com/")) return url;
  return url.replace(/\/t_[a-z0-9]+\//, "/t_1080p/");
};

interface GameCoverCardProps {
  game: Pick<GameDetail, "name" | "coverUrl" | "owned" | "wishlisted" | "isOnSale" | "autoDiscovered">;
}

const GameCoverCard = ({ game }: GameCoverCardProps) => {
  const { t } = useTranslation();
  const theme = useTheme();
  // Only ever rendered for an already-imported game on its own Game Detail page, so
  // owned/wishlisted is always meaningful here — no context gate needed like GameCard's.
  const isGreyscale = !game.owned && !game.wishlisted;
  // Same deal as GameCard's failedCoverUrl: a dead cover URL falls back to the
  // "No Image Available" placeholder instead of the browser's broken-image icon.
  const [failedCoverUrl, setFailedCoverUrl] = useState<string | null>(null);
  const coverFailed = failedCoverUrl !== null && failedCoverUrl === game.coverUrl;
  const [fullscreen, setFullscreen] = useState(false);
  const coverSrc = resolveAssetUrl(game.coverUrl) ?? undefined;
  // See GameCard.tsx's identical split — only a still-unclaimed "what's missing" discovery
  // gets the chip, not every greyscaled (not-yet-owned) cover.
  const showMissingChip = isGreyscale && game.autoDiscovered;

  return (
    <>
    <Card
      sx={{
        // Used to cap out at a fixed 260/320px below the md breakpoint, centered with
        // empty space on either side — looked fine on an actual narrow phone, but on a
        // wide desktop window any width below md (zoomed in, or just resized) left the
        // cover stuck at that fixed size while the grid column around it kept growing,
        // exactly the "doesn't scale with the rest of the page" effect. Always filling the
        // column's actual width is correct at every breakpoint, not just md and up.
        width: "100%",
        maxWidth: "100%",
        position: "relative",
        borderRadius: 2,
        border: `1px solid ${theme.palette.divider}`,
        overflow: "hidden",
      }}
    >
      <OwnershipBadges owned={game.owned} wishlisted={game.wishlisted} />
      <Tooltip title={game.name}>
        {/* aspect-ratio lives on this wrapper, not the <img> itself — see GameCard.tsx for why
            (aspect-ratio + object-fit directly on a replaced element is the combination
            that's been flaky across browsers under non-100% zoom). */}
        <Box sx={{ position: "relative", aspectRatio: "3 / 4", overflow: "hidden" }}>
          {game.coverUrl && !coverFailed ? (
            <CardMedia
              component="img"
              alt={game.name}
              image={coverSrc}
              onError={() => setFailedCoverUrl(game.coverUrl)}
              onClick={() => setFullscreen(true)}
              sx={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                filter: isGreyscale ? "grayscale(1)" : "none",
                cursor: "pointer",
              }}
            />
          ) : (
            <Box
              sx={{
                position: "absolute",
                inset: 0,
                bgcolor: "action.hover",
                color: "text.secondary",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 1,
                p: 2,
                textAlign: "center",
              }}
            >
              <ImageNotSupportedOutlinedIcon fontSize="large" />
              <Typography variant="body2">{t("games.coverCard.noImageAvailable")}</Typography>
            </Box>
          )}
          {game.isOnSale ? (
            <Chip
              label={t("games.card.onSaleLabel")}
              color="success"
              size="small"
              sx={{
                position: "absolute",
                bottom: 8,
                left: 8,
                zIndex: 1,
                fontWeight: 600,
                boxShadow: theme.shadows[3],
              }}
            />
          ) : null}
          {showMissingChip ? (
            <Chip
              label={t("games.card.missingLabel")}
              color="info"
              size="small"
              sx={{
                position: "absolute",
                bottom: 8,
                right: 8,
                zIndex: 1,
                fontWeight: 600,
                boxShadow: theme.shadows[3],
              }}
            />
          ) : null}
        </Box>
      </Tooltip>
    </Card>
    <Dialog
      fullScreen
      open={fullscreen}
      onClose={() => setFullscreen(false)}
      sx={{ "& .MuiDialog-paper": { bgcolor: "black" } }}
    >
      {/* Clicking anywhere dismisses, as does Esc and the close button. The artwork
      itself renders in full color: the card's greyscale is an ownership signal, and
      the viewer is for looking at the art. */}
      <Box
        onClick={() => setFullscreen(false)}
        sx={{
          position: "relative",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <IconButton
          aria-label={t("common.close")}
          onClick={() => setFullscreen(false)}
          sx={{ position: "absolute", top: 8, right: 8, color: "white", zIndex: 1 }}
        >
          <CloseIcon />
        </IconButton>
        {coverSrc ? (
          <Box
            component="img"
            alt={game.name}
            src={fullSizeCoverUrl(coverSrc) ?? undefined}
            sx={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
          />
        ) : null}
      </Box>
    </Dialog>
    </>
  );
};

export default GameCoverCard;
