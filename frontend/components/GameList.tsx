import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AddIcon from "@mui/icons-material/Add";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Collapse from "@mui/material/Collapse";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import type { GameListFilters, MatchAllFilters } from "../api/games";
import type { GameCategory, GameSortOption, GameSummary, MediaFormat, PlayStatus } from "../api/types";
import { useCollections, useFranchises } from "../hooks/useCatalogBrowse";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useDeleteGame, useGames } from "../hooks/useGames";
import { usePlatforms } from "../hooks/usePlatforms";
import { useGameModes } from "../hooks/useGameModes";
import { useGenres } from "../hooks/useGenres";
import { useStorefronts } from "../hooks/useStorefronts";
import { toast } from "react-toastify";
import { useTags } from "../hooks/useTags";
import { bulkUpdateGameVisibility } from "../api/games";
import { useUndoableAction } from "../hooks/useUndoableAction";
import { gameIdentifier } from "../utils/identifiers";
import { matchesOwnership } from "../utils/ownershipFilter";
import { ALL_KNOWN_STOREFRONTS } from "../utils/storefronts";
import { showUndoToast } from "./UndoToast";
import GameCard from "./GameCard";
import GameListToolbar, { type OwnershipStatus } from "./GameListToolbar";
import ManageTagsDialog from "./ManageTagsDialog";
import VirtualGameGrid from "./VirtualGameGrid";
import { usePruneStaleIds, useSessionState } from "../hooks/useSessionState";
import { useScrollCollapse } from "../hooks/useScrollCollapse";
import { useAppearance } from "../theme/AppearanceProvider";
import { useSearchHandoff } from "../navigation/GlobalSearch";

const MIN_SEARCH_LENGTH = 3;

interface GameListProps {
  sessionPrefix?: string;
  forcedFilters?: Partial<GameListFilters>;
  initialOwnershipStatuses?: OwnershipStatus[];
  // Optional title override for the default header — Playing/Wishlist pages show
  // their own name instead of "Games" while keeping the same header (count, Newest,
  // Add button). A custom `header` still wins outright when provided.
  title?: string;
  // Hard-coded ownership scope, the client-side mirror of forcedFilters (which can't
  // express ownership — GameListFilters has no ownership field, so ownership is
  // filtered here, not by the backend). When set, the list always shows exactly
  // these statuses regardless of the toolbar's Ownership field, the same way
  // forcedFilters pins the Playing page to playing.
  forcedOwnershipStatuses?: OwnershipStatus[];
  header?: React.ReactNode;
  // Optional section nav slot — only Unlinked Games uses it (InsightsSubNav). The
  // Games subnav itself is gone; passing nothing renders no subnav row.
  subNav?: React.ReactNode;
}

const GameList = ({ sessionPrefix = "games", forcedFilters, initialOwnershipStatuses, forcedOwnershipStatuses, title, header, subNav }: GameListProps) => {
  const { t } = useTranslation();
  const collapsed = useScrollCollapse();
  // Tabs and title: hidden once scrolled, only return when back at the very top
  const hideHeader = useScrollCollapse(10);

  const sp = sessionPrefix;
  const [searchKeyword, setSearchKeyword] = useSessionState(`${sp}.searchKeyword`, "");
  // The header search's Enter lands here with its text.
  useSearchHandoff("search", setSearchKeyword);
  const [ownershipStatuses, setOwnershipStatuses] = useSessionState<OwnershipStatus[]>(
    `${sp}.ownershipStatuses`,
    initialOwnershipStatuses ?? []
  );
  const [ownershipExclude, setOwnershipExclude] = useSessionState(`${sp}.ownershipExclude`, false);
  const [platformIds, setPlatformIds] = useSessionState<number[]>(`${sp}.platformIds`, []);
  const [platformExclude, setPlatformExclude] = useSessionState(`${sp}.platformExclude`, false);
  const [tagIds, setTagIds] = useSessionState<number[]>(`${sp}.tagIds`, []);
  const [tagExclude, setTagExclude] = useSessionState(`${sp}.tagExclude`, false);
  const [genreIds, setGenreIds] = useSessionState<number[]>(`${sp}.genreIds`, []);
  const [genreExclude, setGenreExclude] = useSessionState(`${sp}.genreExclude`, false);
  const [gameModes, setGameModes] = useSessionState<string[]>(`${sp}.gameModes`, []);
  const [gameModeExclude, setGameModeExclude] = useSessionState(`${sp}.gameModeExclude`, false);
  const [collectionIds, setCollectionIds] = useSessionState<number[]>(`${sp}.collectionIds`, []);
  const [collectionExclude, setCollectionExclude] = useSessionState(`${sp}.collectionExclude`, false);
  const [franchiseIds, setFranchiseIds] = useSessionState<number[]>(`${sp}.franchiseIds`, []);
  const [franchiseExclude, setFranchiseExclude] = useSessionState(`${sp}.franchiseExclude`, false);
  const [gameTypes, setGameTypes] = useSessionState<GameCategory[]>(`${sp}.gameTypes`, []);
  const [gameTypeExclude, setGameTypeExclude] = useSessionState(`${sp}.gameTypeExclude`, false);
  const [formats, setFormats] = useSessionState<MediaFormat[]>(`${sp}.formats`, []);
  const [formatExclude, setFormatExclude] = useSessionState(`${sp}.formatExclude`, false);
  const [storefronts, setStorefronts] = useSessionState<string[]>(`${sp}.storefronts`, []);
  const [storefrontExclude, setStorefrontExclude] = useSessionState(`${sp}.storefrontExclude`, false);
  const [playStatuses, setPlayStatuses] = useSessionState<PlayStatus[]>(`${sp}.playStatuses`, []);
  const [playStatusExclude, setPlayStatusExclude] = useSessionState(`${sp}.playStatusExclude`, false);
  const [matchAll, setMatchAll] = useSessionState<MatchAllFilters>(`${sp}.matchAll`, {});
  const [steelbookOnly, setSteelbookOnly] = useSessionState(`${sp}.steelbookOnly`, false);
  const [sort, setSort] = useSessionState<GameSortOption>(`${sp}.sort`, "name_asc");
  // Card size is per page (Options menu) — seeded from the global appearance size on
  // first visit, then remembered for this page's session key only.
  const { cardSize: globalCardSize } = useAppearance();
  const [cardSize, setCardSize] = useSessionState(`${sp}.cardSize`, globalCardSize);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<number>>(new Set());
  const [manageTagsOpen, setManageTagsOpen] = useState(false);
  const navigate = useNavigate();

  const trimmedKeyword = searchKeyword.trim();
  const debouncedKeyword = useDebouncedValue(trimmedKeyword, 500);
  const [forceSearch, setForceSearch] = useState(false);
  const isSearchActive = forceSearch || debouncedKeyword.length >= MIN_SEARCH_LENGTH;
  const activeKeyword = forceSearch ? trimmedKeyword : debouncedKeyword;
  const isPendingDebounce =
    !forceSearch &&
    trimmedKeyword.length >= MIN_SEARCH_LENGTH &&
    trimmedKeyword !== debouncedKeyword;

  // Clear forceSearch when the user types something new
  const handleSearchKeywordChange = (value: string) => {
    setForceSearch(false);
    setSearchKeyword(value);
  };

  const { data: platforms = [], isSuccess: platformsLoaded } = usePlatforms();
  const { data: tags = [], isSuccess: tagsLoaded } = useTags();
  const { data: collections = [], isSuccess: collectionsLoaded } = useCollections();
  const { data: franchises = [], isSuccess: franchisesLoaded } = useFranchises();
  usePruneStaleIds(platformIds, setPlatformIds, platforms, platformsLoaded);
  usePruneStaleIds(tagIds, setTagIds, tags, tagsLoaded);
  usePruneStaleIds(collectionIds, setCollectionIds, collections, collectionsLoaded);
  usePruneStaleIds(franchiseIds, setFranchiseIds, franchises, franchisesLoaded);
  const { data: genres = [], isSuccess: genresLoaded } = useGenres();
  const { data: gameModeOptions = [] } = useGameModes();
  usePruneStaleIds(genreIds, setGenreIds, genres, genresLoaded);
  const { data: realStorefronts = [] } = useStorefronts();
  // Always offer every storefront the app knows about (Steam/GOG/PlayStation Store/etc.),
  // not just whatever already happens to exist in the data — otherwise a brand-new instance
  // (or one that's simply never added a PSN/Xbox/etc. digital copy yet) would have nothing
  // to pick from for those storefronts at all.
  const storefrontOptions = useMemo(
    () => Array.from(new Set([...ALL_KNOWN_STOREFRONTS, ...realStorefronts])).sort(),
    [realStorefronts]
  );

  const gameListFilters = useMemo(
    () => ({
      search: isSearchActive && activeKeyword.length > 0 ? activeKeyword : undefined,
      platformIds: platformIds.length > 0 ? platformIds : undefined,
      platformExclude,
      tagIds: tagIds.length > 0 ? tagIds : undefined,
      tagExclude,
      genreIds: genreIds.length > 0 ? genreIds : undefined,
      genreExclude,
      gameModes: gameModes.length > 0 ? gameModes : undefined,
      gameModeExclude,
      collectionIds: collectionIds.length > 0 ? collectionIds : undefined,
      collectionExclude,
      franchiseIds: franchiseIds.length > 0 ? franchiseIds : undefined,
      franchiseExclude,
      categories: gameTypes.length > 0 ? gameTypes : undefined,
      categoryExclude: gameTypeExclude,
      formats: formats.length > 0 ? formats : undefined,
      formatExclude,
      storefronts: storefronts.length > 0 ? storefronts : undefined,
      storefrontExclude,
      playStatuses: playStatuses.length > 0 ? playStatuses : undefined,
      playStatusExclude,
      matchAll,
      steelbookOnly,
      sort,
      // forcedFilters last so they override the component's own filter state
      ...forcedFilters,
    }),
    [
      isSearchActive,
      debouncedKeyword,
      platformIds,
      platformExclude,
      tagIds,
      tagExclude,
      genreIds,
      genreExclude,
      gameModes,
      gameModeExclude,
      collectionIds,
      collectionExclude,
      franchiseIds,
      franchiseExclude,
      gameTypes,
      gameTypeExclude,
      formats,
      formatExclude,
      storefronts,
      storefrontExclude,
      playStatuses,
      playStatusExclude,
      matchAll,
      steelbookOnly,
      sort,
      forcedFilters,
    ]
  );
  const { data: games, isLoading, isFetching } = useGames(gameListFilters);
  const isSearching = isPendingDebounce || (isSearchActive && isFetching);

  const deleteGameMutation = useDeleteGame();
  const { schedule, isPending, delayMs } = useUndoableAction<GameSummary>({
    getId: (game) => game.id,
    onCommit: async (gamesToRemove) => {
      await Promise.all(gamesToRemove.map((game) => deleteGameMutation.mutateAsync(game.id)));
    },
  });

  // Forced scope wins over the toolbar's Ownership field (see forcedOwnershipStatuses).
  const effectiveOwnershipStatuses = forcedOwnershipStatuses ?? ownershipStatuses;

  const filteredGames = useMemo(() => {
    if (!games) return [];
    // The Games list never shows a Collection/Series "what's missing" discovery that hasn't
    // been claimed yet — unconditionally, with no toggle to reveal it (unlike the Collection/
    // Series detail pages, where that's the whole point). A manually-added game that just
    // isn't owned/wishlisted yet is unaffected — it stays visible (greyscaled, no chip; see
    // GameCard.tsx) since it was never "missing" in that sense.
    let list = games.filter((game) => !(game.autoDiscovered && !game.owned && !game.wishlisted));
    if (effectiveOwnershipStatuses.length > 0) {
      list = list.filter((game) =>
        matchesOwnership(game, effectiveOwnershipStatuses, ownershipExclude, matchAll.ownership)
      );
    }
    return list;
  }, [games, effectiveOwnershipStatuses, ownershipExclude, matchAll.ownership]);

  const visibleGames = useMemo(
    () => filteredGames.filter((game) => !isPending(game.id)),
    [filteredGames, isPending]
  );

  const handleGameClick = (game: GameSummary) => {
    navigate(`/game/${gameIdentifier(game)}`);
  };

  const toggleSelected = (gameId: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(gameId)) {
        next.delete(gameId);
      } else {
        next.add(gameId);
      }
      return next;
    });
  };

  const handleEnterSelectionMode = () => {
    setSelectionMode(true);
    setSelectedIds(new Set());
  };

  const handleExitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  // True once every currently-visible game is selected — drives both the toggle's next
  // action and its "active" visual state (see GameListToolbar.tsx). false (not true) when
  // there's nothing visible to select, so an empty list never shows the button as active.
  const allVisibleSelected =
    visibleGames.length > 0 && visibleGames.every((game) => selectedIds.has(game.id));

  const handleToggleSelectAll = () => {
    setSelectedIds(allVisibleSelected ? new Set() : new Set(visibleGames.map((game) => game.id)));
  };

  const handleBulkDelete = () => {
    const itemsToRemove = visibleGames.filter((game) => selectedIds.has(game.id));
    if (itemsToRemove.length === 0) {
      return;
    }
    const { undo } = schedule(itemsToRemove);
    setSelectionMode(false);
    setSelectedIds(new Set());
    showUndoToast(
      t("games.list.gamesRemovedToast", { count: itemsToRemove.length }),
      undo,
      delayMs
    );
  };

  const handleBulkVisibility = async (hide: boolean) => {
    const gamesToUpdate = visibleGames.filter((game) => selectedIds.has(game.id));
    if (gamesToUpdate.length === 0) {
      return;
    }
    try {
      const result = await bulkUpdateGameVisibility(
        gamesToUpdate.map((g) => g.id),
        hide
      );
      toast.success(
        t(hide ? "games.list.gamesHiddenToast" : "games.list.gamesUnhiddenToast", {
          count: result.updated,
        })
      );
    } catch {
      toast.error(t("games.list.gamesHiddenErrorToast"));
    }
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const hasActiveFilters =
    isSearchActive ||
    ownershipStatuses.length > 0 ||
    platformIds.length > 0 ||
    tagIds.length > 0 ||
    genreIds.length > 0 ||
    gameModes.length > 0 ||
    collectionIds.length > 0 ||
    franchiseIds.length > 0 ||
    gameTypes.length > 0 ||
    formats.length > 0 ||
    storefronts.length > 0 ||
    steelbookOnly;

  const clearAllFilters = () => {
    setSearchKeyword("");
    setForceSearch(false);
    setOwnershipStatuses([]);
    setOwnershipExclude(false);
    setPlatformIds([]);
    setPlatformExclude(false);
    setTagIds([]);
    setTagExclude(false);
    setGenreIds([]);
    setGenreExclude(false);
    setGameModes([]);
    setGameModeExclude(false);
    setCollectionIds([]);
    setCollectionExclude(false);
    setFranchiseIds([]);
    setFranchiseExclude(false);
    setGameTypes([]);
    setGameTypeExclude(false);
    setFormats([]);
    setFormatExclude(false);
    setStorefronts([]);
    setStorefrontExclude(false);
    setPlayStatuses([]);
    setPlayStatusExclude(false);
    setMatchAll({});
    setSteelbookOnly(false);
  };

  return (
    <>
      <Box
        sx={{
          position: "sticky",
          // Dock exactly under the fixed AppBar: 56px on phones, 64px on wider
          // screens. The old flat mixins.toolbar.minHeight resolved to 56 at every
          // width, so on desktop the stuck bar slid 8px underneath the AppBar.
          top: { xs: 56, sm: 64 },
          zIndex: 1,
          bgcolor: "background.default",
          pt: 0.5,
          pb: 2,
          // Once scrolled content locks under this sticky header, the bottom edge needs to
          // read as an intentional floating panel rather than content abruptly disappearing.
          boxShadow: "0 4px 8px -4px rgba(0, 0, 0, 0.2)",
        }}
      >
        {subNav ? (
          <Collapse in={!hideHeader}>
            {subNav}
          </Collapse>
        ) : null}
        <Collapse in={!hideHeader}>
        {header ?? (
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 2,
            mb: 2,
          }}
        >
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              {title ?? t("games.list.pageTitle")}
            </Typography>
            {games !== undefined ? (
              <Typography variant="body2" color="text.secondary">
                {t(
                  visibleGames.length === 1
                    ? "catalog.refCard.gameCountSingular"
                    : "catalog.refCard.gameCountPlural",
                  { count: visibleGames.length }
                )}
              </Typography>
            ) : null}
          </Box>
          <Stack direction="column" spacing={1} sx={{ flexShrink: 0 }}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => navigate("/games/add")}
            >
              {t("games.list.addGameButton")}
            </Button>
            <Button
              variant={sort === "date_added_desc" ? "contained" : "outlined"}
              color={sort === "date_added_desc" ? "secondary" : "primary"}
              onClick={() =>
                setSort(sort === "date_added_desc" ? "name_asc" : "date_added_desc")
              }
            >
              {t("games.list.newestButton")}
            </Button>
          </Stack>
        </Box>
        )}
        </Collapse>
        <GameListToolbar
            searchKeyword={searchKeyword}
            onSearchKeywordChange={handleSearchKeywordChange}
            onSearchSubmit={() => setForceSearch(true)}
            ownershipStatuses={ownershipStatuses}
            onOwnershipStatusesChange={setOwnershipStatuses}
            ownershipExclude={ownershipExclude}
            onOwnershipExcludeChange={setOwnershipExclude}
            selectionMode={selectionMode}
            selectedCount={selectedIds.size}
            visibleCount={visibleGames.length}
            onEnterSelectionMode={handleEnterSelectionMode}
            onExitSelectionMode={handleExitSelectionMode}
            allVisibleSelected={allVisibleSelected}
            onToggleSelectAll={handleToggleSelectAll}
            onManageTagsClick={() => setManageTagsOpen(true)}
            onBulkDelete={handleBulkDelete}
            onBulkHide={() => handleBulkVisibility(true)}
            onBulkUnhide={() => handleBulkVisibility(false)}
            platformOptions={platforms}
            platformIds={platformIds}
            onPlatformIdsChange={setPlatformIds}
            platformExclude={platformExclude}
            onPlatformExcludeChange={setPlatformExclude}
            tagOptions={tags}
            tagIds={tagIds}
            onTagIdsChange={setTagIds}
            tagExclude={tagExclude}
            onTagExcludeChange={setTagExclude}
            genreOptions={genres}
            genreIds={genreIds}
            onGenreIdsChange={setGenreIds}
            genreExclude={genreExclude}
            onGenreExcludeChange={setGenreExclude}
            gameModeOptions={gameModeOptions}
            gameModes={gameModes}
            onGameModesChange={setGameModes}
            gameModeExclude={gameModeExclude}
            onGameModeExcludeChange={setGameModeExclude}
            collectionOptions={collections}
            collectionIds={collectionIds}
            onCollectionIdsChange={setCollectionIds}
            collectionExclude={collectionExclude}
            onCollectionExcludeChange={setCollectionExclude}
            franchiseOptions={franchises}
            franchiseIds={franchiseIds}
            onFranchiseIdsChange={setFranchiseIds}
            franchiseExclude={franchiseExclude}
            onFranchiseExcludeChange={setFranchiseExclude}
            gameTypes={gameTypes}
            onGameTypesChange={setGameTypes}
            gameTypeExclude={gameTypeExclude}
            onGameTypeExcludeChange={setGameTypeExclude}
            formats={formats}
            onFormatsChange={setFormats}
            formatExclude={formatExclude}
            onFormatExcludeChange={setFormatExclude}
            storefrontOptions={storefrontOptions}
            storefronts={storefronts}
            onStorefrontsChange={setStorefronts}
            storefrontExclude={storefrontExclude}
            onStorefrontExcludeChange={setStorefrontExclude}
            steelbookOnly={steelbookOnly}
            onSteelbookOnlyChange={setSteelbookOnly}
            sort={sort}
            onSortChange={setSort}
            cardSize={cardSize}
            onCardSizeChange={setCardSize}
            playStatuses={playStatuses}
            onPlayStatusesChange={setPlayStatuses}
            playStatusExclude={playStatusExclude}
            onPlayStatusExcludeChange={setPlayStatusExclude}
            matchAll={matchAll}
            onMatchAllChange={setMatchAll}
            />
      </Box>
      {/* Contains z-index in here to its own stacking context — otherwise MUI's
          shrunk-label z-index (1, same as the sticky header above) ties with the sticky
          box's and falls back to DOM order, letting a floating label paint on top of the
          sticky header instead of staying hidden behind it. */}
      <Box sx={{ isolation: "isolate" }}>
        {isLoading ? (
          <Paper sx={{ p: 3, textAlign: "center" }}>{t("common.loading")}</Paper>
        ) : isSearching ? (
          <Paper sx={{ p: 3, textAlign: "center" }}>{t("games.list.searching")}</Paper>
        ) : visibleGames.length === 0 ? (
          <Paper sx={{ p: 3, textAlign: "center" }}>
            {hasActiveFilters ? (
              <>
                <Typography>
                  {t(isSearchActive ? "games.list.noGamesFound" : "games.list.noGamesMatchFilter")}
                </Typography>
                <Button onClick={clearAllFilters} variant="outlined" sx={{ mt: 2 }}>
                  {t("games.listToolbar.clearFiltersButton")}
                </Button>
              </>
            ) : (
              <>
                <Typography>{t("games.list.pleaseAddGames")}</Typography>
                <Button
                  onClick={() => navigate("/games/add")}
                  variant="contained"
                  startIcon={<AddIcon />}
                  sx={{ mt: 2 }}
                >
                  {t("games.list.addGameButton")}
                </Button>
              </>
            )}
          </Paper>
        ) : (
          <VirtualGameGrid
            cardSize={cardSize}
            items={visibleGames}
            getKey={(game) => game.id}
            renderItem={(game) => (
              <GameCard
                game={game}
                context="list"
                contextFunction={() => handleGameClick(game)}
                selectable={selectionMode}
                selected={selectedIds.has(game.id)}
                onToggleSelect={() => toggleSelected(game.id)}
                ownedPlatforms={game.ownedPlatforms}
              />
            )}
          />
        )}
      </Box>
      <ManageTagsDialog
        open={manageTagsOpen}
        gameIds={Array.from(selectedIds)}
        onClose={() => setManageTagsOpen(false)}
      />
    </>
  );
};

export default GameList;
