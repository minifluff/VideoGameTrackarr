import { Fragment, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import AddCircleOutlineOutlinedIcon from "@mui/icons-material/AddCircleOutlineOutlined";
import AddIcon from "@mui/icons-material/Add";
import TuneIcon from "@mui/icons-material/Tune";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonBase from "@mui/material/ButtonBase";
import IconButton from "@mui/material/IconButton";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import type { GameSummary, RecentlyAddedHardwareItem } from "../api/types";
import { useDashboardStats, useReleaseCalendar } from "../hooks/useDashboard";
import { useEvents } from "../hooks/useEvents";
import { useGames } from "../hooks/useGames";
import { useHardwareStats } from "../hooks/useHardwareStats";
import { useAccessoriesWithoutOwnedHardware, useDuplicateLibraryItems, useMissingAddons, useOnSale } from "../hooks/useInsights";
import { useOverviewLayout, type OverviewSection, type OverviewSectionKey } from "../hooks/useOverviewLayout";
import { useShareLink } from "../hooks/useShareLink";
import { useCurrency } from "../theme/CurrencyProvider";
import { formatCurrency } from "../utils/currency";
import { gameIdentifier, hardwareIdentifier } from "../utils/identifiers";
import { TOAST_OPTIONS } from "../utils/toastOptions";
import CustomizeOverviewDialog from "./CustomizeOverviewDialog";
import EventsTeaserSection from "./EventsTeaserSection";
import GameCard from "./GameCard";
import HardwareCard from "./HardwareCard";
import OnSaleTeaserSection from "./OnSaleTeaserSection";
import ReleaseCalendarSection from "./ReleaseCalendarSection";
import { Section, Strip } from "./Section";
import { formatPlaytime, StatTile, TileGrid } from "./Stats";

const STRIP_COLUMN = 150;

const SectionLink = ({ children, onClick, to }: { children: ReactNode; onClick?: () => void; to?: string }) => (
  <Box
    {...(to ? { component: Link, to } : { component: ButtonBase, onClick })}
    // `font` first: the shorthand would reset the size after it.
    sx={{ font: "inherit", fontSize: 12.5, fontWeight: 600, color: "primary.main", textDecoration: "none", whiteSpace: "nowrap", px: 0.5 }}
  >
    {children}
  </Box>
);

// The home page, following upstream's Overview: headline numbers, quick add, events,
// sales and the release calendars, what you're playing, recent additions and the gaps worth
// filling in. Customize hides and reorders the sections (saved on the account; see
// useOverviewLayout). Deeper breakdowns live on Insights.
// Two deliberate fork differences: the Custom-games attention tile is left out (this
// fork's games API has no source filter, so there's no cheap count for it), and the
// header keeps the fork's Add Game button plus an icon-only Customize button. The
// Display Mode and Public Game Collection buttons are layout entries (last by default),
// so they can be hidden and reordered from Customize like any section.
const DashboardPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currency } = useCurrency();
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: hardwareStats, isLoading: hardwareStatsLoading } = useHardwareStats();
  const { data: releases, isLoading: releasesLoading } = useReleaseCalendar();
  const { data: onSaleItems, isLoading: onSaleLoading } = useOnSale();
  const { data: playing } = useGames({ playStatuses: ["playing"] });
  const { data: missingAddons } = useMissingAddons();
  const { data: duplicates } = useDuplicateLibraryItems();
  const { data: orphans } = useAccessoriesWithoutOwnedHardware();
  const { data: events } = useEvents();
  const { data: shareToken } = useShareLink();
  const { layout, cardSize, save: saveLayout } = useOverviewLayout();
  const [customizing, setCustomizing] = useState(false);

  if (statsLoading || hardwareStatsLoading || releasesLoading || onSaleLoading) {
    return (
      <Stack spacing={3}>
        <Skeleton variant="text" width="35%" height={44} />
        <Skeleton variant="rectangular" height={180} sx={{ borderRadius: 2 }} />
        <Skeleton variant="rectangular" height={180} sx={{ borderRadius: 2 }} />
      </Stack>
    );
  }

  const gameCard = (game: GameSummary) => (
    <GameCard key={game.id} game={game} context="list" contextFunction={() => navigate(`/game/${gameIdentifier(game)}`)} />
  );
  const hardwareCard = (item: RecentlyAddedHardwareItem) => {
    const device = item.device;
    const accessory = item.accessory;
    if (item.kind === "device" && device) {
      return (
        <HardwareCard
          key={`device-${device.id}`}
          name={device.officialName}
          subtitle={[device.manufacturerName, device.hardwarePlatformName].filter(Boolean).join(" · ")}
          imageUrl={device.imageUrl}
          owned={device.owned}
          wishlisted={device.wishlisted}
          ownedQuantity={device.ownedQuantity}
          onClick={() => navigate(`/hardware/device/${hardwareIdentifier(device.officialName, device.uuid)}`)}
        />
      );
    }
    if (item.kind === "accessory" && accessory) {
      return (
        <HardwareCard
          key={`accessory-${accessory.id}`}
          name={accessory.officialName}
          subtitle={[accessory.manufacturerName, accessory.accessoryTypeName].filter(Boolean).join(" · ")}
          imageUrl={accessory.imageUrl}
          owned={accessory.owned}
          wishlisted={accessory.wishlisted}
          ownedQuantity={accessory.ownedQuantity}
          onClick={() => navigate(`/hardware/accessory/${hardwareIdentifier(accessory.officialName, accessory.uuid)}`)}
        />
      );
    }
    return null;
  };

  const hardwareOwned = hardwareStats ? hardwareStats.ownedConsoles + hardwareStats.ownedAccessories : undefined;
  const backlog = stats?.playStatusBreakdown.backlog ?? 0;
  const hasGameReleases = (releases ?? []).some((item) => item.kind === "game");
  const hasHardwareReleases = (releases ?? []).some((item) => item.kind !== "game");
  const hasOnSale = Boolean(onSaleItems && onSaleItems.length > 0);
  const isEmpty = stats && hardwareStats && stats.totalTracked === 0 && hardwareOwned === 0 && hardwareStats.wishlistHardware === 0;

  const quickAdd = [
    { label: t("nav.addGame"), to: "/games/add" },
    { label: t("nav.addDevice"), to: "/hardware/device/add" },
    { label: t("nav.addAccessory"), to: "/hardware/accessory/add" },
  ];

  const labels: Record<OverviewSectionKey, string> = {
    stats: t("overview.customize.stats"),
    quickAdd: t("overview.quickAdd"),
    events: t("insights.dashboard.eventsHeading"),
    onSale: t("insights.dashboard.onSaleHeading"),
    gamesCalendar: t("insights.dashboard.gamesCalendarHeading"),
    hardwareCalendar: t("insights.dashboard.hardwareCalendarHeading"),
    nowPlaying: t("overview.nowPlaying"),
    recentlyPlayed: t("overview.recentlyPlayed"),
    recentlyAddedGames: t("overview.recentlyAddedGames"),
    recentlyAddedHardware: t("overview.recentlyAddedHardware"),
    needsAttention: t("overview.needsAttention"),
    displayMode: t("insights.dashboard.displayModeButton"),
    publicCollection: t("insights.dashboard.publicCollectionButton"),
  };

  const attention = [
    { key: "missingAddons", label: t("nav.missingAddons"), value: missingAddons?.length, to: "/insights/missing-addons" },
    { key: "duplicates", label: t("overview.attention.duplicates"), value: duplicates?.length, to: "/insights/duplicates" },
    { key: "orphans", label: t("overview.attention.orphans"), value: orphans?.length, to: "/insights/orphaned-accessories" },
  ];

  const sections: Record<OverviewSectionKey, ReactNode> = {
    stats: (
      <TileGrid>
        <StatTile
          label={t("overview.tiles.gamesOwned")}
          value={stats?.totalOwned ?? "–"}
          hint={stats ? t("overview.tiles.tracked", { count: stats.totalTracked }) : undefined}
          onClick={() => navigate("/games")}
        />
        <StatTile
          label={t("overview.tiles.wishlist")}
          value={stats?.totalWishlisted ?? "–"}
          to="/games/wishlist"
        />
        <StatTile
          label={t("overview.tiles.hardwareOwned")}
          value={hardwareOwned ?? "–"}
          hint={
            hardwareStats
              ? t("overview.tiles.hardwareHint", { devices: hardwareStats.ownedConsoles, accessories: hardwareStats.ownedAccessories })
              : undefined
          }
          to="/hardware"
        />
        <StatTile
          label={t("games.stats.playtimeLoggedLabel")}
          value={stats ? formatPlaytime(stats.totalPlaytimeMinutes, t) : "–"}
          to="/insights"
        />
        <StatTile
          label={t("hardware.stats.collectionValue")}
          value={hardwareStats ? formatCurrency(hardwareStats.collectionValue, currency, { maximumFractionDigits: 0 }) : "–"}
          to="/insights"
        />
      </TileGrid>
    ),
    quickAdd: (
      <Section id="quick-add" title={t("overview.quickAdd")}>
        <TileGrid min={200}>
          {quickAdd.map((item) => (
            <ButtonBase
              key={item.to}
              component={Link}
              to={item.to}
              sx={{
                justifyContent: "flex-start",
                gap: 1.25,
                p: 2,
                borderRadius: 2,
                border: 1,
                borderColor: "divider",
                bgcolor: "background.paper",
                fontWeight: 600,
                color: "primary.main",
                "&:hover": { borderColor: "primary.main" },
              }}
            >
              <AddCircleOutlineOutlinedIcon />
              {item.label}
            </ButtonBase>
          ))}
        </TileGrid>
      </Section>
    ),
    events: events?.length ? <EventsTeaserSection cardSize={cardSize} /> : null,
    // The release calendars and the on-sale row use the same fixed card widths as the
    // strips below (game cards 150, hardware cards 170, both times the card-size
    // scale), so every dashboard card is the same size.
    onSale: hasOnSale ? <OnSaleTeaserSection cardSize={cardSize} columnWidth={STRIP_COLUMN * cardSize} /> : null,
    gamesCalendar: hasGameReleases ? (
      <ReleaseCalendarSection scope="games" title={labels.gamesCalendar} cardSize={cardSize} columnWidth={STRIP_COLUMN * cardSize} />
    ) : null,
    hardwareCalendar: hasHardwareReleases ? (
      <ReleaseCalendarSection scope="hardware" title={labels.hardwareCalendar} cardSize={cardSize} columnWidth={(STRIP_COLUMN + 20) * cardSize} />
    ) : null,
    nowPlaying: (
      <Section
        id="now-playing"
        title={t("overview.nowPlaying")}
        action={
          <Box sx={{ display: "flex", gap: 1 }}>
            <SectionLink onClick={() => navigate("/games")}>
              {t("overview.backlogLink", { count: backlog })}
            </SectionLink>
            {playing?.length ? (
              <SectionLink onClick={() => navigate("/games/playing")}>{t("common.viewAll")}</SectionLink>
            ) : null}
          </Box>
        }
      >
        {playing?.length ? (
          <Strip columnWidth={STRIP_COLUMN * cardSize}>{playing.map(gameCard)}</Strip>
        ) : (
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {t("overview.nothingPlaying")}
          </Typography>
        )}
      </Section>
    ),
    recentlyPlayed: stats?.recentlyPlayed.length ? (
      <Section id="recently-played" title={t("overview.recentlyPlayed")}>
        <Strip columnWidth={STRIP_COLUMN * cardSize}>{stats.recentlyPlayed.map(gameCard)}</Strip>
      </Section>
    ) : null,
    recentlyAddedGames: stats?.recentlyAdded.length ? (
      <Section id="recently-added" title={t("overview.recentlyAddedGames")} action={<SectionLink to="/games">{t("common.viewAll")}</SectionLink>}>
        <Strip columnWidth={STRIP_COLUMN * cardSize}>{stats.recentlyAdded.map(gameCard)}</Strip>
      </Section>
    ) : null,
    recentlyAddedHardware: hardwareStats?.recentlyAdded.length ? (
      <Section
        id="recently-added-hardware"
        title={t("overview.recentlyAddedHardware")}
        action={<SectionLink to="/hardware">{t("common.viewAll")}</SectionLink>}
      >
        <Strip columnWidth={(STRIP_COLUMN + 20) * cardSize}>{hardwareStats.recentlyAdded.map(hardwareCard)}</Strip>
      </Section>
    ) : null,
    needsAttention: (
      <Section id="needs-attention" title={t("overview.needsAttention")}>
        <TileGrid>
          {attention.map((tile) => (
            <StatTile
              key={tile.key}
              label={tile.label}
              value={tile.value ?? "–"}
              to={tile.to}
              quiet={tile.value === 0}
            />
          ))}
        </TileGrid>
      </Section>
    ),
    displayMode: (
      <Button
        variant="contained"
        fullWidth
        size="large"
        sx={{ mt: 3, py: 1.5, fontSize: "1.1rem" }}
        onClick={() => navigate("/display-mode")}
      >
        {t("insights.dashboard.displayModeButton")}
      </Button>
    ),
    publicCollection: shareToken ? (
      <Button
        variant="contained"
        fullWidth
        size="large"
        sx={{ mt: 3, py: 1.5, fontSize: "1.1rem" }}
        onClick={() => navigate(`/public/${shareToken}/games`)}
      >
        {t("insights.dashboard.publicCollectionButton")}
      </Button>
    ) : null,
  };

  const handleSaveLayout = async (next: OverviewSection[], nextCardSize: number) => {
    try {
      await saveLayout.mutateAsync({ layout: next, cardSize: nextCardSize });
      setCustomizing(false);
    } catch (error) {
      console.error("Error saving the Dashboard layout:", error);
      toast.error(t("overview.customize.saveError"), TOAST_OPTIONS);
    }
  };

  if (isEmpty) {
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

  const visible = layout.filter((section) => !section.hidden);

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
        <Tooltip title={t("overview.customize.button")}>
          <IconButton
            size="small"
            sx={{ ml: 1 }}
            aria-label={t("overview.customize.button")}
            onClick={() => setCustomizing(true)}
          >
            <TuneIcon />
          </IconButton>
        </Tooltip>
      </Stack>

      {visible.map((section) => (
        <Fragment key={section.key}>{sections[section.key]}</Fragment>
      ))}
      {visible.length === 0 ? (
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          {t("overview.customize.allHidden")}
        </Typography>
      ) : null}

      {customizing ? (
        <CustomizeOverviewDialog
          layout={layout}
          cardSize={cardSize}
          labels={labels}
          saving={saveLayout.isPending}
          onClose={() => setCustomizing(false)}
          onSave={(next, nextCardSize) => void handleSaveLayout(next, nextCardSize)}
        />
      ) : null}
    </>
  );
};

export default DashboardPage;
