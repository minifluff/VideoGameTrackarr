import { Suspense } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import LogoutIcon from "@mui/icons-material/Logout";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import Link from "@mui/material/Link";
import Switch from "@mui/material/Switch";
import { useTheme } from "@mui/material/styles";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTranslation } from "react-i18next";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import OfflineStatusIndicator from "./components/OfflineStatusIndicator";
import RestoreGuard from "./components/RestoreGuard";

import { useLogout } from "./hooks/useAuth";
import { useScrollResetOnNavigate } from "./hooks/useScrollResetOnNavigate";
import BottomNavBar, { BOTTOM_NAV_HEIGHT } from "./navigation/BottomNavBar";
import GlobalSearch from "./navigation/GlobalSearch";
import NavDrawer, { NAV_DRAWER_WIDTH } from "./navigation/NavDrawer";
import NavRail, { NAV_RAIL_WIDTH } from "./navigation/NavRail";
import { useColorMode } from "./theme/ColorModeProvider";
import { isCustomIconDataUrl, resolveIconSrc, useAppearance } from "./theme/AppearanceProvider";

// M3's three responsive navigation patterns: Navigation Bar (compact/mobile, bottom),
// Navigation Rail (medium/tablet, icons-only side rail), Navigation Drawer
// (expanded/desktop, icons+labels side panel) — picked by breakpoint, not a user toggle.
// The old mini-variant collapsible drawer (M2-style, manually opened/closed) is gone.
const AppShell = () => {
  const { t } = useTranslation();
  const { mode, toggleColorMode } = useColorMode();
  const { appTitle, appIcon } = useAppearance();
  const theme = useTheme();
  const isCompact = useMediaQuery(theme.breakpoints.down("sm"));
  const isExpanded = useMediaQuery(theme.breakpoints.up("lg"));
  const navigate = useNavigate();
  const logoutMutation = useLogout();
  useScrollResetOnNavigate();

  const handleLogout = () => {
    // Clearing tokens/cache alone doesn't move the user off the current (now-stale)
    // protected page — ProtectedLayout only re-checks auth on navigation, and nothing
    // here triggers one. Without this, the redirect only happens once some unrelated
    // background request 401s, which can take a while (staleTime is 30s) or never happen
    // at all if nothing refetches.
    logoutMutation.mutate(undefined, { onSuccess: () => navigate("/login") });
  };

  const sideNavWidth = isCompact ? 0 : isExpanded ? NAV_DRAWER_WIDTH : NAV_RAIL_WIDTH;
  // Mirrors MUI's default Toolbar breakpoint (56px below `sm`, 64px at `sm` and up) so the
  // breadcrumb bar docks flush under the fixed AppBar with no gap or overlap.
  const appBarHeight = isCompact ? 56 : 64;

  return (
    <Box sx={{ display: "flex" }}>
      <RestoreGuard />
      <Link
        href="#main-content"
        sx={{
          position: "absolute",
          left: -9999,
          top: "auto",
          "&:focus": {
            position: "fixed",
            left: 8,
            top: 8,
            zIndex: (t) => t.zIndex.tooltip,
            p: 1.5,
            bgcolor: "background.paper",
            borderRadius: 1,
          },
        }}
      >
        {t("appShell.skipToMainContent")}
      </Link>
      <AppBar position="fixed" sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}>
        <Toolbar>
          <Box
            onClick={() => navigate("/")}
            role="button"
            tabIndex={0}
            title={t("nav.dashboard")}
            aria-label={t("nav.dashboard")}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                navigate("/");
              }
            }}
            sx={{
              mr: 1.5,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              "&:focus-visible": { outline: "2px solid white", borderRadius: 1 },
            }}
          >
            {appIcon === "default" || isCustomIconDataUrl(appIcon) ? (
              <Box
                component="img"
                src={resolveIconSrc(appIcon)}
                alt=""
                sx={{ height: 44, width: 44 }}
              />
            ) : (
              <Box
                sx={{
                  height: 44,
                  width: 44,
                  fontSize: 36,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {appIcon}
              </Box>
            )}
          </Box>
          <Typography variant="h6" component="div" noWrap sx={{ minWidth: 0, flexGrow: 1 }}>
            {appTitle}
          </Typography>
          <Box
            sx={{
              flexGrow: 1,
              minWidth: 0,
              display: { xs: "none", sm: "flex" },
              justifyContent: "center",
            }}
          >
            <GlobalSearch />
          </Box>
          <OfflineStatusIndicator />
          <FormControlLabel
            control={<Switch checked={mode === "dark"} onChange={toggleColorMode} />}
            label={t("appShell.darkMode")}
            sx={{
              mr: 1,
              ".MuiFormControlLabel-label": { display: { xs: "none", sm: "block" } },
            }}
          />
          <IconButton color="inherit" onClick={handleLogout} title={t("common.logOut")} aria-label={t("common.logOut")}>
            <LogoutIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      {isCompact ? null : isExpanded ? <NavDrawer /> : <NavRail />}

      <Box
        component="main"
        id="main-content"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          width: { sm: `calc(100% - ${sideNavWidth}px)` },
          p: { xs: 1.5, sm: 2, md: 3 },
          // Bottom nav is 64px + safe-area for phones with home indicator — keep
          // page content (incl. Save buttons at the bottom) well clear of it.
          // 140px gives comfortable clearance even with Android's gesture nav bar.
          pb: isCompact ? `calc(140px + env(safe-area-inset-bottom, 0px))` : undefined,
        }}
      >
        <Toolbar />
        <Suspense
          fallback={
            <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
              <CircularProgress />
            </Box>
          }
        >
          <Outlet />
        </Suspense>
      </Box>

      {isCompact ? <BottomNavBar /> : null}
      <ToastContainer theme="colored" />
    </Box>
  );
};

export default AppShell;
