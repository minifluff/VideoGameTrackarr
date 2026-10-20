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
// login on this surface), no side nav rail/drawer (just 2 destinations, handled by
// PublicSubNav below). Read-only pages don't need the offline/update/toast chrome either.
const PublicShell = () => {
  const { t } = useTranslation();
  const { mode, toggleColorMode } = useColorMode();
  const { appTitle, appIcon } = useAppearance();
  useScrollResetOnNavigate();

  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <AppBar position="fixed">
        <Toolbar>
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
          <Typography variant="h6" component="div" noWrap sx={{ minWidth: 0, flexGrow: 1 }}>
            {appTitle}
          </Typography>
          <FormControlLabel
            control={<Switch checked={mode === "dark"} onChange={toggleColorMode} />}
            label={t("appShell.darkMode")}
            sx={{ ".MuiFormControlLabel-label": { display: { xs: "none", sm: "block" } } }}
          />
        </Toolbar>
      </AppBar>
      <Box component="main" sx={{ flexGrow: 1, p: { xs: 1.5, sm: 2, md: 3 } }}>
        <Toolbar />
        <PublicSubNav />
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
