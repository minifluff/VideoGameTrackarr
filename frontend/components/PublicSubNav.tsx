import { Link, useLocation, useParams } from "react-router-dom";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import { useTranslation } from "react-i18next";
import { useScrollCollapse } from "../hooks/useScrollCollapse";

// Mirrors GamesSubNav.tsx's chip-row pattern — just 2 destinations here, so no need for
// the full responsive nav rail/drawer/bottom-bar the authenticated app uses.
const PublicSubNav = () => {
  const { token } = useParams<{ token: string }>();
  const location = useLocation();
  const { t } = useTranslation();
  const collapsed = useScrollCollapse(80);

  const items = [
    { to: `/public/${token}/games`, labelKey: "public.nav.games" },
    { to: `/public/${token}/hardware`, labelKey: "public.nav.hardware" },
  ] as const;

  return (
    <Collapse in={!collapsed} timeout={200}>
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 3 }}>
      {items.map((item) => {
        // Prefix match too, so Games stays selected on a game's own page.
        const isSelected =
          location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
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

export default PublicSubNav;
