import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import AddIcon from "@mui/icons-material/Add";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { useReleaseCalendar } from "../hooks/useDashboard";
import { useOnSale } from "../hooks/useInsights";
import OnSaleTeaserSection from "./OnSaleTeaserSection";
import ReleaseCalendarSection from "./ReleaseCalendarSection";

interface DashboardSection {
  key: string;
  node: ReactNode;
}

const DashboardPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: releases, isLoading: releasesLoading } = useReleaseCalendar();
  const { data: onSaleItems, isLoading: onSaleLoading } = useOnSale();
  if (releasesLoading || onSaleLoading) {
    return (
      <Stack spacing={3}>
        <Skeleton variant="text" width="35%" height={44} />
        <Skeleton variant="rectangular" height={180} sx={{ borderRadius: 2 }} />
        <Skeleton variant="rectangular" height={180} sx={{ borderRadius: 2 }} />
      </Stack>
    );
  }

  const hasGameReleases = (releases ?? []).some((item) => item.kind === "game");
  const hasHardwareReleases = (releases ?? []).some((item) => item.kind !== "game");
  const hasOnSale = Boolean(onSaleItems && onSaleItems.length > 0);

  const sections = [
    hasGameReleases && {
      key: "games",
      node: (
        <ReleaseCalendarSection
          scope="games"
          title={t("insights.dashboard.gamesCalendarHeading")}
        />
      ),
    },
    hasOnSale && { key: "onSale", node: <OnSaleTeaserSection /> },
    hasHardwareReleases && {
      key: "hardware",
      node: (
        <ReleaseCalendarSection
          scope="hardware"
          title={t("insights.dashboard.hardwareCalendarHeading")}
        />
      ),
    },
  ].filter(Boolean) as DashboardSection[];

  if (sections.length === 0) {
    return (
      <>
        <Typography
          variant="h5"
          component="h2"
          color="text.secondary"
          sx={{ textAlign: "center", mt: 6 }}
        >
          {t("insights.dashboard.welcomeMessage")}
        </Typography>
        <Button
          variant="contained"
          fullWidth
          size="large"
          startIcon={<AddIcon />}
          sx={{ mt: 4, py: 1.5, fontSize: "1.1rem" }}
          onClick={() => navigate("/games/add")}
        >
          {t("insights.dashboard.addGameButton")}
        </Button>
        <Button
          variant="outlined"
          fullWidth
          size="large"
          sx={{ mt: 2, py: 1.5, fontSize: "1.1rem" }}
          onClick={() => navigate("/display-mode")}
        >
          {t("insights.dashboard.displayModeButton")}
        </Button>
      </>
    );
  }

  return (
    <>
      <Stack direction="row" sx={{ mb: 3, alignItems: "center" }}>
        <Typography variant="h4" component="h1" sx={{ flexGrow: 1 }}>
          {t("insights.dashboard.pageTitle")}
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate("/games/add")}
        >
          {t("insights.dashboard.addGameButton")}
        </Button>
      </Stack>
      {sections.map((section, index) => (
        <Box key={section.key}>
          {index > 0 && <Divider sx={{ my: 3 }} />}
          {section.node}
        </Box>
      ))}
      <Button
        variant="contained"
        fullWidth
        size="large"
        sx={{ mt: 3, py: 1.5, fontSize: "1.1rem" }}
        onClick={() => navigate("/display-mode")}
      >
        {t("insights.dashboard.displayModeButton")}
      </Button>
    </>
  );
};

export default DashboardPage;
