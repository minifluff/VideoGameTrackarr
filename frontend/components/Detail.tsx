import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";

// Ported from upstream's Detail.tsx: the shared building blocks for the detail pages'
// list-style sections (library copies, progress rows, play sessions). Only the pieces
// the ported sections use are here — Section and Strip already live in ./Section.tsx,
// and DetailHero/DetailColumns aren't needed by any fork section yet.
//
// Upstream's kit references its vgt theme tokens (vgt.text3, vgt.surface2, vgt.border,
// vgt.accentSoft, vgt.surfaceHover, vgt.owned, vgt.wishlist), which this fork's M3
// theme doesn't define — so each one is mapped to the closest fork token below:
// text3 -> text.secondary, surface2/accentSoft/surfaceHover -> action.hover,
// border -> divider, owned -> success.main, wishlist -> the fork's wishlist pink
// (the same #ff6b8b OwnershipBadges uses). The translucent border/background rgba
// values are upstream's and work in either mode.

interface PillProps {
  icon?: ReactNode;
  children: ReactNode;
  tone?: "owned" | "wishlist" | "accent" | "success" | "danger";
  // Shorter, for a chip inside a list row.
  small?: boolean;
  href?: string;
  to?: string;
  title?: string;
}

const PILL_TONES = {
  owned: { border: "rgba(63,178,127,.45)", bg: "rgba(63,178,127,.12)", color: "success.main" },
  wishlist: { border: "rgba(255,107,139,.45)", bg: "rgba(255,107,139,.12)", color: "#ff6b8b" },
  success: { border: "rgba(63,178,127,.45)", bg: "rgba(63,178,127,.12)", color: "success.main" },
  danger: { border: "rgba(229,83,75,.45)", bg: "rgba(229,83,75,.12)", color: "error.main" },
  accent: { border: "primary.main", bg: "action.hover", color: "text.primary" },
} as const;

// Rounded fact chip in a hero or list row (status, play status, platforms...).
export const Pill = ({ icon, children, tone, href, to, title, small = false }: PillProps) => {
  const link = href
    ? { component: "a", href, target: "_blank", rel: "noopener noreferrer" }
    : to
      ? { component: Link, to }
      : {};
  const colors = tone ? PILL_TONES[tone] : null;
  return (
    <Box
      component="span"
      title={title}
      {...link}
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.625,
        height: small ? 24 : 28,
        px: small ? 1 : 1.25,
        borderRadius: 3.5,
        fontSize: small ? 12 : 12.5,
        fontWeight: 500,
        whiteSpace: "nowrap",
        maxWidth: "100%",
        overflow: "hidden",
        textOverflow: "ellipsis",
        textDecoration: "none",
        border: 1,
        borderColor: colors?.border ?? "divider",
        bgcolor: colors?.bg ?? "action.hover",
        color: colors?.color ?? "text.primary",
        "& svg": { fontSize: 16, flexShrink: 0 },
        ...(href || to ? { "&:hover": { borderColor: "primary.main" } } : {}),
      }}
    >
      {icon}
      {children}
    </Box>
  );
};

// A section's content in a bordered panel (lists that need a surface).
export const Panel = ({ children }: { children: ReactNode }) => (
  <Box sx={{ border: 1, borderColor: "divider", borderRadius: 2, bgcolor: "background.paper", overflow: "hidden" }}>
    {children}
  </Box>
);

export const Facts = ({ facts }: { facts: [string, ReactNode][] }) => (
  <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 1.25 }}>
    {facts
      .filter(([, value]) => value !== null && value !== undefined && value !== "")
      .map(([label, value]) => (
        <Box
          key={label}
          sx={{ bgcolor: "background.paper", border: 1, borderColor: "divider", borderRadius: 2, px: 1.5, py: 1.25, minWidth: 0 }}
        >
          <Typography sx={{ fontSize: 11.5, color: "text.secondary" }}>{label}</Typography>
          <Typography component="div" sx={{ fontWeight: 600, mt: 0.25, wordBreak: "break-word" }}>
            {value}
          </Typography>
        </Box>
      ))}
  </Box>
);

// A section's own action, at the end of its title rule ("Add copy", "Add", "Log session").
export const SectionAction = ({
  icon,
  label,
  onClick,
  to,
  ...rest
}: {
  icon: ReactNode;
  label: string;
  onClick?: (event: React.MouseEvent<HTMLElement>) => void;
  to?: string;
  "aria-haspopup"?: "menu";
}) => (
  <ButtonBase
    {...(to ? { component: Link, to } : { onClick })}
    {...rest}
    sx={{
      gap: 0.5,
      px: 0.75,
      py: 0.25,
      borderRadius: 1,
      fontSize: 12.5,
      fontWeight: 600,
      color: "text.secondary",
      whiteSpace: "nowrap",
      "& svg": { fontSize: 17 },
      "&:hover": { color: "primary.main", bgcolor: "action.hover" },
    }}
  >
    {icon}
    {label}
  </ButtonBase>
);

// One line in a section's list (a copy, a platform's progress, a play session, a note): an
// optional badge, a title and a detail line, then chips and row actions at the end. The whole
// row opens it when `onClick` is set; row actions don't.
export const ListRow = ({
  leading,
  title,
  subtitle,
  trailing,
  actions,
  onClick,
  label,
}: {
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  actions?: ReactNode;
  onClick?: () => void;
  // The row's accessible name when it's clickable.
  label?: string;
}) => (
  <Box
    role={onClick ? "button" : undefined}
    tabIndex={onClick ? 0 : undefined}
    aria-label={onClick ? label : undefined}
    onClick={onClick}
    onKeyDown={(event) => {
      if (onClick && event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        onClick();
      }
    }}
    sx={{
      display: "flex",
      alignItems: "center",
      gap: 1.5,
      px: 1.75,
      py: 1.25,
      minWidth: 0,
      cursor: onClick ? "pointer" : "default",
      "& + &": { borderTop: 1, borderColor: "divider" },
      "&:hover": onClick ? { bgcolor: "action.hover" } : undefined,
      "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: -2 },
    }}
  >
    {leading}
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Box sx={{ fontWeight: 600, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</Box>
      {subtitle ? (
        <Box sx={{ color: "text.secondary", fontSize: 12.5, mt: 0.25, overflowWrap: "anywhere" }}>{subtitle}</Box>
      ) : null}
    </Box>
    {trailing ? <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexShrink: 0 }}>{trailing}</Box> : null}
    {actions ? (
      <Box sx={{ display: "flex", alignItems: "center", flexShrink: 0, mr: -0.75 }} onClick={(event) => event.stopPropagation()}>
        {actions}
      </Box>
    ) : null}
  </Box>
);

// A row's own button (Move, Remove), with its name as a tooltip.
export const RowAction = ({ title, icon, onClick }: { title: string; icon: ReactNode; onClick: () => void }) => (
  <Tooltip title={title}>
    <IconButton size="small" aria-label={title} onClick={onClick} sx={{ color: "text.secondary" }}>
      {icon}
    </IconButton>
  </Tooltip>
);

// The short badge at the start of a copy or progress row ("PS5", "PC").
export const PlatformBadge = ({ children }: { children: ReactNode }) => (
  <Box
    sx={{
      flexShrink: 0,
      minWidth: 44,
      maxWidth: 64,
      height: 30,
      px: 0.75,
      borderRadius: 1.5,
      bgcolor: "action.hover",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 11,
      fontWeight: 700,
      color: "text.secondary",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    }}
  >
    {children}
  </Box>
);

// A section's "nothing here yet" line.
export const EmptyLine = ({ children }: { children: ReactNode }) => (
  <Typography variant="body2" sx={{ color: "text.secondary", fontStyle: "italic" }}>
    {children}
  </Typography>
);
