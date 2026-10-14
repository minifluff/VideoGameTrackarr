import { Link, useLocation } from "react-router-dom";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import { useTranslation } from "react-i18next";
import { useScrollCollapse } from "../hooks/useScrollCollapse";

const SUB_NAV_ITEMS = [
  { to: "/insights", labelKey: "insights.subNav.overview" },
  { to: "/insights/duplicates", labelKey: "nav.duplicates" },
  { to: "/insights/missing-addons", labelKey: "nav.missingAddons" },
  { to: "/insights/orphaned-accessories", labelKey: "nav.orphanedAccessories" },
  { to: "/insights/on-sale", labelKey: "nav.onSale" },
  { to: "/insights/unlinked-games", labelKey: "nav.unlinkedGames" },
] as const;

// Mirrors GamesSubNav.tsx — keeps Duplicates/Missing Addons/Orphaned Accessories reachable
// at every breakpoint, since NavDrawer's nested sub-items are desktop-only.
const InsightsSubNav = () => {
  const { t } = useTranslation();
  const collapsed = useScrollCollapse(80);
  const location = useLocation();

  return (
    <Collapse in={!collapsed} timeout={200}>
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 3 }}>
      {SUB_NAV_ITEMS.map((item) => {
        const isSelected = location.pathname === item.to;
        return (
          <Chip
            key={item.to}
            component={Link}
            to={item.to}
            label={t(item.labelKey)}
            clickable
            color={isSelected ? "primary" : "default"}
            variant={isSelected ? "filled" : "outlined"}
          />
        );
      })}
      </Box>
    </Collapse>
  );
};

export default InsightsSubNav;
