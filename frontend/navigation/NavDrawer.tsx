import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import Box from "@mui/material/Box";
import Collapse from "@mui/material/Collapse";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import { useTranslation } from "react-i18next";
import { getNavDestinations } from "./destinations";
import { useAppearance } from "../theme/AppearanceProvider";

export const NAV_DRAWER_WIDTH = 240;

// Matches AppShell's non-compact Toolbar height — NavDrawer only renders when !isCompact.
const APP_BAR_HEIGHT = 64;

const NavDrawer = () => {
  const location = useLocation();
  const { t } = useTranslation();
  const { hideHardwareMenu } = useAppearance();
  const navDestinations = getNavDestinations(t, { hideHardwareMenu });
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Auto-expand the section containing the current page.
  useEffect(() => {
    const active = navDestinations.find(
      (d) =>
        d.subItems &&
        (location.pathname === d.to || d.subItems.some((sub) => location.pathname === sub.to))
    );
    if (active) {
      setExpanded((prev) => (prev[active.to] ? prev : { ...prev, [active.to]: true }));
    }
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleExpanded = (to: string) => {
    setExpanded((prev) => ({ ...prev, [to]: !prev[to] }));
  };

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: NAV_DRAWER_WIDTH,
        flexShrink: 0,
        "& .MuiDrawer-paper": {
          width: NAV_DRAWER_WIDTH,
          boxSizing: "border-box",
          border: "none",
          // Start below the fixed AppBar and cap height to the rest of the viewport, so if
          // nav content overflows, it gets its own scrollbar confined to this region —
          // instead of scrolling content up underneath the (higher z-index) AppBar, where
          // it'd be invisible rather than just scrolled past.
          top: APP_BAR_HEIGHT,
          height: `calc(100% - ${APP_BAR_HEIGHT}px)`,
          // Thin, subtle scrollbar that fades in only on hover — the menu is long enough
          // to scroll now, but the bar shouldn't dominate the drawer.
          scrollbarWidth: "thin",
          scrollbarColor: "transparent transparent",
          "&:hover": {
            scrollbarColor: "rgba(128, 128, 128, 0.4) transparent",
          },
          "&::-webkit-scrollbar": {
            width: 6,
          },
          "&::-webkit-scrollbar-track": {
            background: "transparent",
          },
          "&::-webkit-scrollbar-thumb": {
            background: "transparent",
            borderRadius: 3,
          },
          "&:hover::-webkit-scrollbar-thumb": {
            background: "rgba(128, 128, 128, 0.4)",
          },
        },
      }}
    >
      <List component="nav" aria-label="Primary" sx={{ px: 1.5 }}>
        {navDestinations.map((destination) => {
          const isSelected = location.pathname === destination.to;
          const hasSubItems = !!destination.subItems && destination.subItems.length > 0;
          const isExpanded = !!expanded[destination.to];
          return (
            <Box key={destination.to}>
              <ListItem
                disablePadding
                sx={{ mb: 0.5 }}
                secondaryAction={
                  hasSubItems ? (
                    <IconButton
                      edge="end"
                      size="small"
                      onClick={() => toggleExpanded(destination.to)}
                      aria-label={isExpanded ? t("common.collapse") : t("common.expand")}
                      sx={{ mr: 0.5 }}
                    >
                      {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                  ) : undefined
                }
              >
                <ListItemButton
                  component={Link}
                  to={destination.to}
                  selected={isSelected}
                  aria-current={isSelected ? "page" : undefined}
                  sx={{ borderRadius: 999 }}
                >
                  <ListItemIcon sx={{ minWidth: 40 }}>{destination.icon}</ListItemIcon>
                  <ListItemText primary={destination.label} />
                </ListItemButton>
              </ListItem>
              {hasSubItems ? (
                <Collapse in={isExpanded} timeout={200} unmountOnExit>
                  {destination.subItems!.map((sub) => {
                    const isSubSelected = location.pathname === sub.to;
                    return (
                      <Box key={sub.to}>
                        {sub.separatorBefore ? <Divider sx={{ my: 0.5, mx: 2 }} /> : null}
                        <ListItem disablePadding sx={{ mb: 0.5, pl: 2 }}>
                          <ListItemButton
                            component={Link}
                            to={sub.to}
                            selected={isSubSelected}
                            aria-current={isSubSelected ? "page" : undefined}
                            sx={{ borderRadius: 999 }}
                            dense
                          >
                            <ListItemIcon sx={{ minWidth: 32 }}>{sub.icon}</ListItemIcon>
                            <ListItemText primary={sub.label} slotProps={{ primary: { variant: "body2" } }} />
                          </ListItemButton>
                        </ListItem>
                      </Box>
                    );
                  })}
                </Collapse>
              ) : null}
            </Box>
          );
        })}
      </List>
    </Drawer>
  );
};

export default NavDrawer;
