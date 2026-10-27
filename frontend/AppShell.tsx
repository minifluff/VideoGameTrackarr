import { Suspense, useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import DarkModeIcon from "@mui/icons-material/DarkModeOutlined";
import LightModeIcon from "@mui/icons-material/LightModeOutlined";
import LogoutIcon from "@mui/icons-material/Logout";
import MenuIcon from "@mui/icons-material/Menu";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import Link from "@mui/material/Link";
import { useTheme } from "@mui/material/styles";
import Toolbar from "@mui/material/Toolbar";
import Tooltip from "@mui/material/Tooltip";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTranslation } from "react-i18next";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import OfflineStatusIndicator from "./components/OfflineStatusIndicator";
import RestoreGuard from "./components/RestoreGuard";

import { useLogout } from "./hooks/useAuth";
import { useScrollResetOnNavigate } from "./hooks/useScrollResetOnNavigate";
import GlobalSearch from "./navigation/GlobalSearch";
import Sidebar, { SIDEBAR_WIDTH } from "./navigation/Sidebar";
import { useColorMode } from "./theme/ColorModeProvider";

// Upstream's model: one Sidebar, permanent on desktop and a hamburger drawer below
// md — replacing the old M3 trio (bottom bar on phones, icons-only rail on tablets,
// full drawer on desktop).
const AppShell = () => {
  const { t } = useTranslation();
  const { mode, toggleColorMode } = useColorMode();
  const themeLabel = mode === "dark" ? t("appShell.lightMode") : t("appShell.darkMode");
  const theme = useTheme();
  const isCompact = useMediaQuery(theme.breakpoints.down("sm"));
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const logoutMutation = useLogout();
  useScrollResetOnNavigate();

  // A drawer left open on a small screen closes when the page changes.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  const handleLogout = () => {
    // Clearing tokens/cache alone doesn't move the user off the current (now-stale)
    // protected page — ProtectedLayout only re-checks auth on navigation, and nothing
    // here triggers one. Without this, the redirect only happens once some unrelated
    // background request 401s, which can take a while (staleTime is 30s) or never happen
    // at all if nothing refetches.
    logoutMutation.mutate(undefined, { onSuccess: () => navigate("/login") });
  };

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
        <Toolbar
          sx={{
            // Three grid cells — logo/title | search | controls — so the search sits
            // centred on the screen, not just in the space left over by the title.
            // On phone widths the title drops out so the search stays visible.
            display: "grid",
            gridTemplateColumns: { xs: "auto 1fr auto", sm: "1fr auto 1fr" },
            alignItems: "center",
            gap: 1,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", minWidth: 0 }}>
            {isDesktop ? null : (
              <IconButton
                onClick={() => setDrawerOpen(true)}
                aria-label={t("appShell.openMenu")}
                title={t("appShell.openMenu")}
                color="inherit"
                sx={{ mr: 1 }}
              >
                <MenuIcon />
              </IconButton>
            )}
          </Box>
          <Box sx={{ minWidth: 0, width: { xs: "100%", sm: "min(520px, 50vw)" }, mx: "auto" }}>
            <GlobalSearch />
          </Box>
          <Box
            sx={{ display: "flex", alignItems: "center", justifyContent: "flex-end", minWidth: 0 }}
          >
            <OfflineStatusIndicator />
            <Tooltip title={themeLabel}>
              <IconButton onClick={toggleColorMode} aria-label={themeLabel} color="inherit">
                {mode === "dark" ? <LightModeIcon /> : <DarkModeIcon />}
              </IconButton>
            </Tooltip>
            <IconButton color="inherit" onClick={handleLogout} title={t("common.logOut")} aria-label={t("common.logOut")}>
              <LogoutIcon />
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>

      {isDesktop ? (
        <Drawer
          variant="permanent"
          sx={{
            width: SIDEBAR_WIDTH,
            flexShrink: 0,
            "& .MuiDrawer-paper": {
              width: SIDEBAR_WIDTH,
              boxSizing: "border-box",
              border: "none",
              // Start below the fixed AppBar and cap height to the rest of the viewport,
              // so overflowing nav gets its own scrollbar confined to this region.
              top: 64,
              height: "calc(100% - 64px)",
            },
          }}
        >
          <Sidebar />
        </Drawer>
      ) : (
        <Drawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          slotProps={{
            paper: { sx: { width: SIDEBAR_WIDTH + 24, borderRight: 1, borderColor: "divider" } },
          }}
        >
          <Sidebar onNavigate={() => setDrawerOpen(false)} />
        </Drawer>
      )}

      <Box
        component="main"
        id="main-content"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          width: { md: `calc(100% - ${SIDEBAR_WIDTH}px)` },
          p: { xs: 1.5, sm: 2, md: 3 },
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

      <ToastContainer theme="colored" />
    </Box>
  );
};

export default AppShell;
