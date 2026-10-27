import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Typography from "@mui/material/Typography";
import type { TFunction } from "i18next";

// Shared pieces for the Dashboard (ported from upstream's Overview): headline tiles and
// the playtime formatter. Upstream's `vgt.*` tokens don't exist in this fork's theme, so
// muted text uses `text.secondary` and the link hover uses `primary.main`.

interface StatTileProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  // A route to open, or a handler (a filtered Games list).
  to?: string;
  onClick?: () => void;
  // Dimmed (a Needs attention tile with nothing to fix).
  quiet?: boolean;
}

export function formatPlaytime(minutes: number, t: TFunction): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours === 0) return t("games.stats.playtimeMinutesShort", { minutes: remainder });
  return remainder === 0
    ? t("games.stats.playtimeHoursShort", { hours })
    : t("games.stats.playtimeHoursMinutesShort", { hours, minutes: remainder });
}

export const StatTile = ({ label, value, hint, icon, to, onClick, quiet }: StatTileProps) => {
  const linkProps = to ? { component: Link, to } : onClick ? { component: ButtonBase, onClick } : {};
  const isLink = Boolean(to || onClick);
  return (
    <Box
      {...linkProps}
      sx={{
        // A column from the top, whether the tile is a link, a button (which centres by
        // default) or plain.
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        justifyContent: "flex-start",
        width: "100%",
        textAlign: "left",
        p: 2,
        bgcolor: "background.paper",
        border: 1,
        borderColor: "divider",
        borderRadius: 2,
        color: "inherit",
        textDecoration: "none",
        font: "inherit",
        opacity: quiet ? 0.6 : 1,
        "&:hover": isLink ? { borderColor: "primary.main" } : undefined,
        "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 2 },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, color: "text.secondary", "& svg": { fontSize: 18 } }}>
        {icon}
        <Typography variant="caption" sx={{ fontWeight: 600 }}>
          {label}
        </Typography>
      </Box>
      <Typography component="div" sx={{ fontSize: 28, fontWeight: 650, letterSpacing: "-0.02em", lineHeight: 1.2, mt: 0.75 }}>
        {value}
      </Typography>
      {hint ? (
        <Typography variant="caption" component="div" sx={{ color: "text.secondary", mt: 0.25 }}>
          {hint}
        </Typography>
      ) : null}
    </Box>
  );
};

export const TileGrid = ({ children, min = 170 }: { children: ReactNode; min?: number }) => (
  // Two columns on phones, where even the smallest minimum would leave one per row.
  <Box
    sx={{
      display: "grid",
      gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", sm: `repeat(auto-fill, minmax(${min}px, 1fr))` },
      gap: 1.5,
    }}
  >
    {children}
  </Box>
);
