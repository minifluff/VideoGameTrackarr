import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { useDashboardStats } from "../hooks/useDashboard";
import { useHardwareStats } from "../hooks/useHardwareStats";
import { useVersion } from "../hooks/useVersion";
import { getNavDestinations, type NavDestination } from "./destinations";
import { isCustomIconDataUrl, resolveIconSrc, useAppearance } from "../theme/AppearanceProvider";

export const SIDEBAR_WIDTH = 240;

interface NavLinkProps {
  to: string;
  label: string;
  icon?: ReactNode;
  selected: boolean;
  sub?: boolean;
  separatorBefore?: boolean;
  count?: number;
  onNavigate?: () => void;
}

const NavLink = ({
  to,
  label,
  icon,
  selected,
  sub = false,
  separatorBefore = false,
  count,
  onNavigate,
}: NavLinkProps) => (
  <ButtonBase
    component={Link}
    to={to}
    onClick={onNavigate}
    aria-current={selected ? "page" : undefined}
    sx={{
      position: "relative",
      width: "100%",
      justifyContent: "flex-start",
      gap: sub ? 1.25 : 1.5,
      px: 1.25,
      py: sub ? 0.625 : 0.875,
      pl: sub ? 4 : 1.25,
      my: "1px",
      mt: separatorBefore ? 1 : "1px",
      borderRadius: 1.5,
      typography: sub ? "body2" : "subtitle2",
      fontWeight: sub ? 500 : 550,
      color: selected ? "text.primary" : "text.secondary",
      bgcolor: selected ? "action.selected" : "transparent",
      "&:hover": {
        bgcolor: selected ? "action.selected" : "action.hover",
        color: "text.primary",
      },
      "& svg": { fontSize: sub ? 17 : 20, color: selected ? "primary.main" : "inherit" },
      "&::before": selected
        ? {
            content: '""',
            position: "absolute",
            left: -10,
            top: 8,
            bottom: 8,
            width: 3,
            borderRadius: "0 3px 3px 0",
            bgcolor: "primary.main",
          }
        : undefined,
      "&::after": separatorBefore
        ? {
            content: '""',
            position: "absolute",
            left: 32,
            right: 10,
            top: -5,
            height: "1px",
            bgcolor: "divider",
          }
        : undefined,
    }}
  >
    {icon}
    <Box component="span" sx={{ flexGrow: 1, textAlign: "left" }}>
      {label}
    </Box>
    {count !== undefined ? (
      <Box
        component="span"
        sx={{
          fontSize: 11,
          fontWeight: 600,
          color: "text.secondary",
          bgcolor: "action.hover",
          px: 0.875,
          borderRadius: 2.5,
          lineHeight: "18px",
        }}
      >
        {count}
      </Box>
    ) : null}
  </ButtonBase>
);

// Prefix match, so a page nested under a destination (an edit page, an add flow) still
// highlights it. "/" is exact, or it would match everything.
function isPathWithin(pathname: string, to: string): boolean {
  if (to === "/") return pathname === "/";
  return pathname === to || pathname.startsWith(`${to}/`);
}

// A game's own page lives at /game/:id, not /games/…, same for addons and Compare.
const SECTION_PREFIXES: Record<string, string[]> = {
  "/games": ["/game", "/addon", "/compare"],
};

function isInSection(pathname: string, to: string): boolean {
  return [to, ...(SECTION_PREFIXES[to] ?? [])].some((prefix) => isPathWithin(pathname, prefix));
}

// Grouped like upstream's sidebar, but over the fork's own destinations (Bookshelf,
// Playing, Wishlist, Games list, Unlinked Games and the Settings sub-pages are fork-only
// and stay reachable). Order inside each group follows the flat destination list, so
// grouping adds headings without reordering anything.
const NAV_GROUPS: { labelKey: string; items: string[] }[] = [
  { labelKey: "nav.groups.library", items: ["/", "/games", "/hardware", "/events"] },
  { labelKey: "nav.groups.insights", items: ["/insights"] },
  { labelKey: "nav.groups.system", items: ["/settings"] },
];

interface SidebarProps {
  // Small screens: the drawer closes after a link is followed.
  onNavigate?: () => void;
}

// The app's one navigation surface: grouped sections, sub-pages that appear under their
// parent while you're inside it, count badges on Games and Hardware, and a quiet footer
// with the version. Permanent on desktop, a drawer on smaller screens (see AppShell).
const Sidebar = ({ onNavigate }: SidebarProps) => {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const { appTitle, appIcon, hideHardwareMenu } = useAppearance();
  const { data: dashboardStats } = useDashboardStats();
  const { data: hardwareStats } = useHardwareStats();
  const { data: version } = useVersion();
  const destinations = getNavDestinations(t, { hideHardwareMenu });
  const byTo = new Map(destinations.map((destination) => [destination.to, destination]));
  const counts: Record<string, number | undefined> = {
    "/games": dashboardStats?.totalTracked,
    "/hardware": hardwareStats
      ? hardwareStats.ownedConsoles +
        hardwareStats.ownedAccessories +
        hardwareStats.wishlistHardware
      : undefined,
  };

  const isActive = (item: NavDestination) => {
    // A sub-page you're on is highlighted instead of its parent.
    const onSub = item.subItems?.some((sub) => isPathWithin(pathname, sub.to));
    return !onSub && isInSection(pathname, item.to);
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", bgcolor: "background.paper" }}>
      <Box
        component={Link}
        to="/"
        onClick={onNavigate}
        sx={{
          height: 56,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: 1.25,
          px: 2,
          borderBottom: 1,
          borderColor: "divider",
          color: "text.primary",
          textDecoration: "none",
        }}
      >
        {appIcon === "default" || isCustomIconDataUrl(appIcon) ? (
          <Box component="img" src={resolveIconSrc(appIcon)} alt="" sx={{ width: 30, height: 30 }} />
        ) : (
          <Box
            sx={{
              width: 30,
              height: 30,
              fontSize: 22,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {appIcon}
          </Box>
        )}
        <Typography
          variant="subtitle2"
          noWrap
          sx={{ fontWeight: 650, fontSize: 14, letterSpacing: "-0.01em" }}
        >
          {appTitle}
        </Typography>
      </Box>
      <Box
        component="nav"
        aria-label={t("nav.primary")}
        sx={{ px: 1.25, pb: 2, overflowY: "auto", flexGrow: 1 }}
      >
        {NAV_GROUPS.map((group) => (
          <Box key={group.labelKey}>
            <Typography
              variant="overline"
              component="div"
              sx={{ color: "text.secondary", px: 1.25, pt: 1.75, pb: 0.5 }}
            >
              {t(group.labelKey)}
            </Typography>
            {group.items.map((to) => {
              const item = byTo.get(to);
              if (!item) return null;
              const inside = item.to !== "/" && isInSection(pathname, item.to);
              return (
                <Box key={item.to}>
                  <NavLink
                    to={item.to}
                    label={item.label}
                    icon={item.icon}
                    selected={isActive(item)}
                    count={counts[item.to]}
                    onNavigate={onNavigate}
                  />
                  {inside
                    ? item.subItems?.map((sub) => (
                        <NavLink
                          key={sub.to}
                          to={sub.to}
                          label={sub.label}
                          icon={sub.icon}
                          selected={isPathWithin(pathname, sub.to)}
                          separatorBefore={sub.separatorBefore}
                          sub
                          onNavigate={onNavigate}
                        />
                      ))
                    : null}
                </Box>
              );
            })}
          </Box>
        ))}
      </Box>
      <Typography
        variant="caption"
        sx={{ color: "text.secondary", px: 2.25, py: 1.25, borderTop: 1, borderColor: "divider" }}
      >
        {version?.currentVersion ? `v${version.currentVersion}` : "VideoGameTrackarr"}
      </Typography>
    </Box>
  );
};

export default Sidebar;
