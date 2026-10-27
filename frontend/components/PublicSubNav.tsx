import { Link, useLocation, useParams } from "react-router-dom";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import { useTranslation } from "react-i18next";
import { useScrollCollapse } from "../hooks/useScrollCollapse";
import { useAppearance } from "../theme/AppearanceProvider";

// Mirrors GamesSubNav.tsx's chip-row pattern — no need for the full responsive nav
// rail/drawer/bottom-bar the authenticated app uses. In the header (inHeader) the row
// sits on the AppBar's primary background, so the chips use contrast text instead of
// the default palette — a filled primary chip would vanish into the bar — and the row
// scrolls horizontally instead of wrapping, so it fits phone widths.
const PublicSubNav = ({ inHeader = false }: { inHeader?: boolean }) => {
  const { token } = useParams<{ token: string }>();
  const location = useLocation();
  const { t } = useTranslation();
  const collapsed = useScrollCollapse(80);
  const { hideHardwareMenu } = useAppearance();

  const allItems = [
    { to: `/public/${token}/games`, labelKey: "public.nav.games" },
    { to: `/public/${token}/bookshelf`, labelKey: "public.nav.bookshelf" },
    { to: `/public/${token}/games/list`, labelKey: "public.nav.list" },
    { to: `/public/${token}/hardware`, labelKey: "public.nav.hardware" },
  ] as const;

  // Same toggle as the main nav's hide-hardware setting — when it's on, the
  // Hardware destination drops out of the public submenu too.
  const items = hideHardwareMenu
    ? allItems.filter((item) => item.labelKey !== "public.nav.hardware")
    : allItems;

  const row = (
    <Box
      sx={
        inHeader
          ? {
              display: "flex",
              gap: 1,
              flexWrap: "nowrap",
              overflowX: "auto",
              scrollbarWidth: "none",
              "&::-webkit-scrollbar": { display: "none" },
            }
          : { display: "flex", gap: 1, flexWrap: "wrap", mb: 3 }
      }
    >
      {items.map((item) => {
        // Exact match for List; Games also stays selected on a game's own detail page
        // (/public/:token/games/:gameId) but not on the List page.
        const isSelected =
          location.pathname === item.to ||
          (item.to.endsWith("/games") &&
            location.pathname.startsWith(`${item.to}/`) &&
            !location.pathname.startsWith(`${item.to}/list`));
        return (
          <Chip
            key={item.to}
            component={Link}
            to={item.to}
            label={t(item.labelKey)}
            clickable
            color={isSelected ? "primary" : "default"}
            variant={isSelected ? "filled" : "outlined"}
            sx={
              inHeader
                ? {
                    flexShrink: 0,
                    color: "primary.contrastText",
                    borderColor: "primary.contrastText",
                    ...(isSelected
                      ? {
                          backgroundColor: "primary.contrastText",
                          color: "primary.main",
                          "&:hover": { backgroundColor: "primary.contrastText" },
                        }
                      : {}),
                  }
                : undefined
            }
          />
        );
      })}
    </Box>
  );

  if (inHeader) return row;
  return (
    <Collapse in={!collapsed} timeout={200}>
      {row}
    </Collapse>
  );
};

export default PublicSubNav;
