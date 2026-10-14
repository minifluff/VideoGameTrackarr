import { useEffect, useRef, useState, type ReactElement } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Paper from "@mui/material/Paper";
import Slide from "@mui/material/Slide";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import { useTranslation } from "react-i18next";
import { getNavDestinations } from "./destinations";

export const BOTTOM_NAV_HEIGHT = 64;

const BottomNavBar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const navDestinations = getNavDestinations(t);

  // Hide on scroll down, show on scroll up — so the nav never blocks content
  // at the bottom of the page (e.g. Save buttons) when the user scrolls there.
  const [visible, setVisible] = useState(true);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      // Show when scrolling up or near the top, hide when scrolling down past 100px
      if (currentScrollY < 100 || currentScrollY < lastScrollY.current) {
        setVisible(true);
      } else if (currentScrollY > lastScrollY.current + 10) {
        setVisible(false);
      }
      lastScrollY.current = currentScrollY;
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Prefix match (not exact) so a nested route — e.g. /games/add, or a detail page one
  // level deeper — still highlights its section's tab, and `false` (no active tab) rather
  // than an unmatched string when nothing applies, since Tabs (unlike BottomNavigation)
  // logs a console warning if `value` doesn't match any child Tab's `value`.
  const activeValue =
    navDestinations.find(
      (destination) => location.pathname === destination.to || location.pathname.startsWith(`${destination.to}/`)
    )?.to ?? false;

  return (
    <Slide direction="up" in={visible} mountOnEnter unmountOnExit>
      <Paper
        elevation={3}
        sx={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: (theme) => theme.zIndex.appBar,
          borderRadius: 0,
        }}
      >
      <Tabs
        value={activeValue}
        onChange={(_event, newValue: string) => navigate(newValue)}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        sx={{
          height: BOTTOM_NAV_HEIGHT,
          "& .MuiTabs-indicator": { display: "none" },
        }}
      >
        {navDestinations.map((destination) => (
          <Tab
            key={destination.to}
            label={destination.label}
            icon={destination.icon as ReactElement}
            iconPosition="top"
            value={destination.to}
            sx={{ minWidth: 72, minHeight: BOTTOM_NAV_HEIGHT }}
          />
        ))}
        </Tabs>
      </Paper>
    </Slide>
  );
};

export default BottomNavBar;
