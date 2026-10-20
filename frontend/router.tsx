import { lazy } from "react";
import { createBrowserRouter } from "react-router-dom";

// Route pages are code-split (React.lazy) so the entry bundle only carries the
// shell + framework — each page (and its page-only dependencies) downloads and
// parses on first navigation to it. The shells wrap their <Outlet/> in a
// <Suspense> boundary with a spinner fallback.
import AppShell from "./AppShell";
const AccessoryDetails = lazy(() => import("./components/AccessoryDetails"));
const AddAccessoryPage = lazy(() => import("./components/AddAccessoryPage"));
const AddDevicePage = lazy(() => import("./components/AddDevicePage"));
const AddGame = lazy(() => import("./components/AddGame"));
const IgdbGamePreviewPage = lazy(() => import("./components/IgdbGamePreviewPage"));
const CollectionPage = lazy(() => import("./components/CollectionPage"));
const CollectionsPage = lazy(() => import("./components/CollectionsPage"));
const ComparePage = lazy(() => import("./components/ComparePage"));
const DashboardPage = lazy(() => import("./components/DashboardPage"));
const DeviceDetails = lazy(() => import("./components/DeviceDetails"));
const DisplayModePage = lazy(() => import("./components/DisplayModePage"));
const DuplicatesPage = lazy(() => import("./components/DuplicatesPage"));
const UnlinkedGamesPage = lazy(() => import("./components/UnlinkedGamesPage"));
const EditAccessoryPage = lazy(() => import("./components/EditAccessoryPage"));
const EditDevicePage = lazy(() => import("./components/EditDevicePage"));
const EditGamePage = lazy(() => import("./components/EditGamePage"));
const EventDetails = lazy(() => import("./components/EventDetails"));
const EventsPage = lazy(() => import("./components/EventsPage"));
const GameDetails = lazy(() => import("./components/GameDetails"));
const GameList = lazy(() => import("./components/GameList"));
const GamesListPage = lazy(() => import("./components/GamesListPage"));
const PlayingGamesPage = lazy(() => import("./components/PlayingGamesPage"));
const WishlistGamesPage = lazy(() => import("./components/WishlistGamesPage"));
const HardwarePage = lazy(() => import("./components/HardwarePage"));
const InsightsPage = lazy(() => import("./components/InsightsPage"));
const IntegrationsPage = lazy(() => import("./components/IntegrationsPage"));
const MissingAddonsPage = lazy(() => import("./components/MissingAddonsPage"));
import NotFoundPage from "./components/NotFoundPage";
const OrphanedAccessoriesPage = lazy(() => import("./components/OrphanedAccessoriesPage"));
import RouteErrorBoundary from "./components/RouteErrorBoundary";
const SeriesDetailPage = lazy(() => import("./components/SeriesDetailPage"));
const SeriesPage = lazy(() => import("./components/SeriesPage"));
const PlatformPage = lazy(() => import("./components/PlatformPage"));
const PlatformsPage = lazy(() => import("./components/PlatformsPage"));
const About = lazy(() => import("./components/About"));
const EmulationPage = lazy(() => import("./components/EmulationPage"));
const JobsPage = lazy(() => import("./components/JobsPage"));
const PublicGameDetailsPage = lazy(() => import("./components/PublicGameDetailsPage"));
const PublicGamesListPage = lazy(() => import("./components/PublicGamesListPage"));
const PublicGamesPage = lazy(() => import("./components/PublicGamesPage"));
const PublicHardwarePage = lazy(() => import("./components/PublicHardwarePage"));
const Settings = lazy(() => import("./components/Settings"));
const SalesIgnoredListPage = lazy(() => import("./components/SalesIgnoredListPage"));
const SaleTrackedPage = lazy(() => import("./components/SaleTrackedPage"));
const SteamSyncPage = lazy(() => import("./components/SteamSyncPage"));
const RemoveGamesPage = lazy(() => import("./components/RemoveGamesPage"));
const PlayniteSyncPage = lazy(() => import("./components/PlayniteSyncPage"));
const OnSalePage = lazy(() => import("./components/OnSalePage"));
const TagManagerPage = lazy(() => import("./components/TagManagerPage"));
const PlatformManagerPage = lazy(() => import("./components/PlatformManagerPage"));
import PublicShell from "./PublicShell";
import {
  accessoryCrumbs,
  addAccessoryCrumbs,
  addDeviceCrumbs,
  addGameCrumbs,
  igdbPreviewCrumbs,
  collectionCrumbs,
  collectionsCrumbs,
  compareCrumbs,
  dashboardCrumbs,
  deviceDetailCrumbs,
  duplicatesCrumbs,
  editAccessoryCrumbs,
  editDeviceCrumbs,
  editGameCrumbs,
  eventDetailCrumbs,
  eventsCrumbs,
  franchiseCrumbs,
  aboutCrumbs,
  gameDetailCrumbs,
  gamesCrumbs,
  hardwareCrumbs,
  insightsCrumbs,
  integrationsCrumbs,
  jobsCrumbs,
  emulationCrumbs,
  missingAddonsCrumbs,
  notFoundCrumbs,
  onSaleCrumbs,
  orphanedAccessoriesCrumbs,
  unlinkedGamesCrumbs,
  platformCrumbs,
  platformsCrumbs,
  saleTrackedCrumbs,
  salesIgnoredCrumbs,
  seriesCrumbs,
  settingsCrumbs,
  steamSyncCrumbs,
  removeGamesCrumbs,
  playniteSyncCrumbs,
  tagManagerCrumbs,
  platformManagerCrumbs,
} from "./navigation/breadcrumbConfig";
import Login from "./pages/Login";
import ProtectedLayout from "./routes/ProtectedLayout";
import { useTranslation } from "react-i18next";

// The AppShell-internal "*" catch-all (a wrong URL, not a crash) — kept inside AppShell so
// the nav/header stay visible, unlike RouteErrorBoundary which renders standalone.
const NotFoundRouteElement = () => {
  const { t } = useTranslation();
  return (
    <NotFoundPage
      title={t("errors.pageNotFoundTitle")}
      message={t("errors.pageNotFoundMessage")}
      actionLabel={t("errors.backToDashboard")}
      actionTo="/"
    />
  );
};

const router = createBrowserRouter([
  // Each top-level branch gets its own errorElement (rather than one shared pathless wrapper
  // route) so a render-time crash lands on this same friendly fallback instead of React
  // Router's raw, unstyled default error screen — regardless of which branch it happened in.
  { path: "/login", element: <Login />, errorElement: <RouteErrorBoundary /> },
  {
    // Deliberately outside ProtectedLayout — no auth check, since access here is gated by
    // the unlisted token in the path instead (see backend/app/api/routes/public.py).
    element: <PublicShell />,
    errorElement: <RouteErrorBoundary />,
    children: [
      { path: "/public/:token/games", element: <PublicGamesPage /> },
      { path: "/public/:token/games/list", element: <PublicGamesListPage /> },
      { path: "/public/:token/games/:gameId", element: <PublicGameDetailsPage /> },
      { path: "/public/:token/hardware", element: <PublicHardwarePage /> },
    ],
  },
  {
    element: <ProtectedLayout />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: "/", element: <DashboardPage />, handle: { crumbs: dashboardCrumbs } },
          { path: "/display-mode", element: <DisplayModePage /> },
          { path: "/events", element: <EventsPage />, handle: { crumbs: eventsCrumbs } },
          {
            path: "/events/:identifier",
            element: <EventDetails />,
            handle: { crumbs: eventDetailCrumbs },
          },
          { path: "/games", element: <GameList />, handle: { crumbs: gamesCrumbs } },
          { path: "/games/list", element: <GamesListPage />, handle: { crumbs: gamesCrumbs } },
          { path: "/games/playing", element: <PlayingGamesPage />, handle: { crumbs: gamesCrumbs } },
          { path: "/games/wishlist", element: <WishlistGamesPage />, handle: { crumbs: gamesCrumbs } },
          { path: "/games/add", element: <AddGame />, handle: { crumbs: addGameCrumbs } },
          {
            path: "/games/add/igdb/:igdbId",
            element: <IgdbGamePreviewPage />,
            handle: { crumbs: igdbPreviewCrumbs },
          },
          {
            path: "/game/:identifier",
            element: <GameDetails />,
            handle: { crumbs: gameDetailCrumbs },
          },
          {
            path: "/game/:identifier/edit",
            element: <EditGamePage />,
            handle: { crumbs: editGameCrumbs },
          },
          {
            path: "/addon/:identifier",
            element: <GameDetails />,
            handle: { crumbs: gameDetailCrumbs },
          },
          { path: "/games/series", element: <SeriesPage />, handle: { crumbs: seriesCrumbs } },
          {
            path: "/games/series/:seriesSlug",
            element: <SeriesDetailPage />,
            handle: { crumbs: franchiseCrumbs },
          },
          {
            path: "/games/collections",
            element: <CollectionsPage />,
            handle: { crumbs: collectionsCrumbs },
          },
          {
            path: "/games/collections/:collectionSlug",
            element: <CollectionPage />,
            handle: { crumbs: collectionCrumbs },
          },
          {
            path: "/games/platforms",
            element: <PlatformsPage />,
            handle: { crumbs: platformsCrumbs },
          },
          {
            path: "/games/platforms/:platformSlug",
            element: <PlatformPage />,
            handle: { crumbs: platformCrumbs },
          },
          { path: "/hardware", element: <HardwarePage />, handle: { crumbs: hardwareCrumbs } },
          {
            path: "/hardware/device/add",
            element: <AddDevicePage />,
            handle: { crumbs: addDeviceCrumbs },
          },
          {
            path: "/hardware/accessory/add",
            element: <AddAccessoryPage />,
            handle: { crumbs: addAccessoryCrumbs },
          },
          {
            path: "/hardware/device/:identifier",
            element: <DeviceDetails />,
            handle: { crumbs: deviceDetailCrumbs },
          },
          {
            path: "/hardware/device/:identifier/edit",
            element: <EditDevicePage />,
            handle: { crumbs: editDeviceCrumbs },
          },
          {
            path: "/hardware/accessory/:identifier",
            element: <AccessoryDetails />,
            handle: { crumbs: accessoryCrumbs },
          },
          {
            path: "/hardware/accessory/:identifier/edit",
            element: <EditAccessoryPage />,
            handle: { crumbs: editAccessoryCrumbs },
          },
          { path: "/insights", element: <InsightsPage />, handle: { crumbs: insightsCrumbs } },
          {
            path: "/insights/duplicates",
            element: <DuplicatesPage />,
            handle: { crumbs: duplicatesCrumbs },
          },
          {
            path: "/insights/missing-addons",
            element: <MissingAddonsPage />,
            handle: { crumbs: missingAddonsCrumbs },
          },
          {
            path: "/insights/orphaned-accessories",
            element: <OrphanedAccessoriesPage />,
            handle: { crumbs: orphanedAccessoriesCrumbs },
          },
          {
            path: "/insights/on-sale",
            element: <OnSalePage />,
            handle: { crumbs: onSaleCrumbs },
          },
          {
            path: "/insights/unlinked-games",
            element: <UnlinkedGamesPage />,
            handle: { crumbs: unlinkedGamesCrumbs },
          },
          { path: "/compare", element: <ComparePage />, handle: { crumbs: compareCrumbs } },
          { path: "/settings", element: <Settings />, handle: { crumbs: settingsCrumbs } },
          {
            path: "/settings/tags",
            element: <TagManagerPage />,
            handle: { crumbs: tagManagerCrumbs },
          },
          {
            path: "/settings/platforms",
            element: <PlatformManagerPage />,
            handle: { crumbs: platformManagerCrumbs },
          },
          { path: "/settings/jobs", element: <JobsPage />, handle: { crumbs: jobsCrumbs } },
          {
            path: "/settings/integrations",
            element: <IntegrationsPage />,
            handle: { crumbs: integrationsCrumbs },
          },
          {
            path: "/settings/emulation",
            element: <EmulationPage />,
            handle: { crumbs: emulationCrumbs },
          },
          {
            path: "/settings/steam-sync",
            element: <SteamSyncPage />,
            handle: { crumbs: steamSyncCrumbs },
          },
          {
            path: "/settings/remove-games",
            element: <RemoveGamesPage />,
            handle: { crumbs: removeGamesCrumbs },
          },
          {
            path: "/settings/playnite-sync",
            element: <PlayniteSyncPage />,
            handle: { crumbs: playniteSyncCrumbs },
          },
          {
            path: "/settings/sale-tracked",
            element: <SaleTrackedPage />,
            handle: { crumbs: saleTrackedCrumbs },
          },
          {
            path: "/settings/sales-ignored",
            element: <SalesIgnoredListPage />,
            handle: { crumbs: salesIgnoredCrumbs },
          },
          { path: "/settings/about", element: <About />, handle: { crumbs: aboutCrumbs } },
          { path: "*", element: <NotFoundRouteElement />, handle: { crumbs: notFoundCrumbs } },
        ],
      },
    ],
  },
]);

export default router;
