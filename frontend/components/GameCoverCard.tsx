import { useRef, useState } from "react";
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
  // Pinch-to-zoom state for the fullscreen viewer: a scale plus a pan offset. Pinching
  // back to 1x snaps the image back to centered; closing resets both.
  const [zoom, setZoom] = useState({ scale: 1, x: 0, y: 0 });
  const gestureRef = useRef<{
    startDist: number;
    startScale: number;
    startX: number;
    startY: number;
    prev: { id: number; x: number; y: number }[];
    pinching: boolean;
  } | null>(null);
  // Some browsers synthesize a click after a pinch ends; swallowing it briefly keeps a
  // pinch from instantly dismissing the viewer it just zoomed.
  const suppressClickUntilRef = useRef(0);

  const closeViewer = () => {
    setFullscreen(false);
    setZoom({ scale: 1, x: 0, y: 0 });
  };

  // TouchList is array-like but not iterable in this TS DOM lib, so index into it.
  const touchPoints = (touches: React.TouchList) =>
    Array.from({ length: touches.length }, (_, index) => {
      const touch = touches[index];
      return { id: touch.identifier, x: touch.clientX, y: touch.clientY };
    });

  const handleViewerTouchStart = (event: React.TouchEvent) => {
    const touches = touchPoints(event.touches);
    gestureRef.current = {
      startDist:
        touches.length === 2
          ? Math.hypot(touches[0].x - touches[1].x, touches[0].y - touches[1].y)
          : 0,
      startScale: zoom.scale,
      startX: zoom.x,
      startY: zoom.y,
      prev: touches,
      pinching: touches.length === 2,
    };
  };

  const handleViewerTouchMove = (event: React.TouchEvent) => {
    const gesture = gestureRef.current;
    if (!gesture) return;
    const touches = touchPoints(event.touches);
    const rect = event.currentTarget.getBoundingClientRect();
    if (touches.length === 2 && gesture.pinching && gesture.startDist > 0) {
      // Scale about the midpoint between the fingers, so the point under the pinch
      // stays put instead of the image zooming away from it.
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const midX = (touches[0].x + touches[1].x) / 2 - centerX;
      const midY = (touches[0].y + touches[1].y) / 2 - centerY;
      const next =
        gesture.startScale *
        (Math.hypot(touches[0].x - touches[1].x, touches[0].y - touches[1].y) /
          gesture.startDist);
      if (next <= 1) {
        setZoom({ scale: 1, x: 0, y: 0 });
      } else {
        const scale = Math.min(next, 4);
        setZoom({
          scale,
          x: midX - (midX - gesture.startX) * (scale / gesture.startScale),
          y: midY - (midY - gesture.startY) * (scale / gesture.startScale),
        });
      }
    } else if (touches.length === 1 && zoom.scale > 1 && gesture.prev.length === 1) {
      // One finger drags a zoomed image around; the offset is clamped so the image
      // can't be panned clean out of view.
      const maxX = (rect.width * zoom.scale) / 2;
      const maxY = (rect.height * zoom.scale) / 2;
      const dx = touches[0].x - gesture.prev[0].x;
      const dy = touches[0].y - gesture.prev[0].y;
      setZoom((current) => ({
        ...current,
        x: Math.max(-maxX, Math.min(maxX, current.x + dx)),
        y: Math.max(-maxY, Math.min(maxY, current.y + dy)),
      }));
    }
    gestureRef.current = { ...gesture, prev: touches };
  };

  const handleViewerTouchEnd = (event: React.TouchEvent) => {
    const gesture = gestureRef.current;
    if (gesture?.pinching) suppressClickUntilRef.current = Date.now() + 350;
    const touches = touchPoints(event.touches);
    gestureRef.current = touches.length > 0 && gesture ? { ...gesture, prev: touches, pinching: false } : null;
  };

  const handleViewerClick = () => {
    if (Date.now() < suppressClickUntilRef.current) return;
    closeViewer();
  };
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
      onClose={closeViewer}
      sx={{ "& .MuiDialog-paper": { bgcolor: "black" } }}
    >
      {/* Clicking anywhere dismisses, as does Esc and the close button. The artwork
      itself renders in full color: the card's greyscale is an ownership signal, and
      the viewer is for looking at the art. touchAction none keeps the browser from
      hijacking the pinch for its own page zoom, so the gesture reaches the handlers. */}
      <Box
        onClick={handleViewerClick}
        onTouchStart={handleViewerTouchStart}
        onTouchMove={handleViewerTouchMove}
        onTouchEnd={handleViewerTouchEnd}
        sx={{
          position: "relative",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          touchAction: "none",
          overflow: "hidden",
        }}
      >
        <IconButton
          aria-label={t("common.close")}
          onClick={(event) => {
            event.stopPropagation();
            closeViewer();
          }}
          sx={{ position: "absolute", top: 8, right: 8, color: "white", zIndex: 1 }}
        >
          <CloseIcon />
        </IconButton>
        {coverSrc ? (
          <Box
            component="img"
            alt={game.name}
            src={fullSizeCoverUrl(coverSrc) ?? undefined}
            // Inline, not sx: the transform changes every touchmove, and an inline
            // style is also what the tests can read back.
            style={{ transform: `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.scale})` }}
            sx={{
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
              touchAction: "none",
            }}
          />
        ) : null}
      </Box>
    </Dialog>
    </>
  );
};

export default GameCoverCard;
