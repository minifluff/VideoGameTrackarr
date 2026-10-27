import { Suspense } from "react";
import { Outlet } from "react-router-dom";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import PublicSubNav from "./components/PublicSubNav";
import { useScrollResetOnNavigate } from "./hooks/useScrollResetOnNavigate";
import { useColorMode } from "./theme/ColorModeProvider";
import { isCustomIconDataUrl, resolveIconSrc, useAppearance } from "./theme/AppearanceProvider";

// Deliberately minimal, not a stripped-down AppShell — no logout/user menu (there's no
// login on this surface), no side nav rail/drawer (destinations handled by PublicSubNav
// in the title bar). Read-only pages don't need the offline/update/toast chrome either.
const PublicShell = () => {
  const { t } = useTranslation();
  const { mode, toggleColorMode } = useColorMode();
  const { appTitle, appIcon } = useAppearance();
  useScrollResetOnNavigate();

  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <AppBar position="fixed">
        <Toolbar
          sx={{
            // Three grid cells — logo/title | subnav | controls — so the subnav sits
            // centred in the title bar. On phone widths the title drops out, leaving
            // logo, subnav and switch, so the subnav stays visible.
            display: "grid",
            gridTemplateColumns: { xs: "auto 1fr auto", sm: "1fr auto 1fr" },
            alignItems: "center",
            gap: 1,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", minWidth: 0 }}>
            {appIcon === "default" || isCustomIconDataUrl(appIcon) ? (
              <Box
                component="img"
                src={resolveIconSrc(appIcon)}
                alt=""
                sx={{ height: 44, width: 44, mr: 1.5 }}
              />
            ) : (
              <Box
                sx={{
                  height: 44,
                  width: 44,
                  mr: 1.5,
                  fontSize: 36,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {appIcon}
              </Box>
            )}
            <Typography
              variant="h6"
              component="div"
              noWrap
              sx={{ minWidth: 0, flexGrow: 1, display: { xs: "none", sm: "block" } }}
            >
              {appTitle}
            </Typography>
          </Box>
          <PublicSubNav inHeader />
          <Box
            sx={{ display: "flex", alignItems: "center", justifyContent: "flex-end", minWidth: 0 }}
          >
            <FormControlLabel
              control={<Switch checked={mode === "dark"} onChange={toggleColorMode} />}
              label={t("appShell.darkMode")}
              sx={{ ".MuiFormControlLabel-label": { display: { xs: "none", sm: "block" } } }}
            />
          </Box>
        </Toolbar>
      </AppBar>
      <Box component="main" sx={{ flexGrow: 1, p: { xs: 1.5, sm: 2, md: 3 } }}>
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
    </Box>
  );
};

export default PublicShell;
