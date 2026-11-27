import { useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import type { MatchAllFilters } from "../api/games";
import type { GameSortOption, MediaFormat, PlayStatus, ReleaseStatus } from "../api/types";
import { useCollections, useFranchises } from "../hooks/useCatalogBrowse";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useMissingAddons } from "../hooks/useInsights";
import { useLibraryPlatforms } from "../hooks/usePlatforms";
import { useStorefronts } from "../hooks/useStorefronts";
import { useTags } from "../hooks/useTags";
import { gameIdentifier } from "../utils/identifiers";
import { matchesOwnership } from "../utils/ownershipFilter";
import { platformDisplayName, platformScopeKey } from "../utils/platformScope";
import { useGameModes } from "../hooks/useGameModes";
import { useGenres } from "../hooks/useGenres";
import { ALL_KNOWN_STOREFRONTS } from "../utils/storefronts";
import GameCard from "./GameCard";
import GameListToolbar, { TIME_TO_BEAT_OPTIONS, type OwnershipStatus, type TimeToBeatRange } from "./GameListToolbar";
import VirtualList from "./VirtualList";
import { usePruneStaleIds, useSessionState } from "../hooks/useSessionState";

const MIN_SEARCH_LENGTH = 3;

const MissingAddonsSection = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [searchKeyword, setSearchKeyword] = useSessionState("missingAddons.searchKeyword", "");
  const [ownershipStatuses, setOwnershipStatuses] = useSessionState<OwnershipStatus[]>("missingAddons.ownershipStatuses", []);
  const [ownershipExclude, setOwnershipExclude] = useSessionState("missingAddons.ownershipExclude", false);
  const [platformIds, setPlatformIds] = useSessionState<number[]>("missingAddons.platformIds", []);
  const [platformScopes, setPlatformScopes] = useSessionState<string[]>("missingAddons.platformScopes", []);
  const [platformExclude, setPlatformExclude] = useSessionState("missingAddons.platformExclude", false);
  const [tagIds, setTagIds] = useSessionState<number[]>("missingAddons.tagIds", []);
  const [tagExclude, setTagExclude] = useSessionState("missingAddons.tagExclude", false);
  const [genreIds, setGenreIds] = useSessionState<number[]>("missingAddons.genreIds", []);
  const [genreExclude, setGenreExclude] = useSessionState("missingAddons.genreExclude", false);
  const [releaseStatuses, setReleaseStatuses] = useSessionState<ReleaseStatus[]>("missingAddons.releaseStatuses", []);
  const [releaseYearFrom, setReleaseYearFrom] = useSessionState<number | null>("missingAddons.releaseYearFrom", null);
  const [releaseYearTo, setReleaseYearTo] = useSessionState<number | null>("missingAddons.releaseYearTo", null);
  const [localPlayersMin, setLocalPlayersMin] = useSessionState<number | null>("missingAddons.localPlayersMin", null);
  const [onlineMultiplayerOnly, setOnlineMultiplayerOnly] = useSessionState("missingAddons.onlineMultiplayerOnly", false);
  const [coopOnly, setCoopOnly] = useSessionState("missingAddons.coopOnly", false);
  const [timeToBeat, setTimeToBeat] = useSessionState<TimeToBeatRange | null>("missingAddons.timeToBeat", null);
  const [ratingMin, setRatingMin] = useSessionState<number | null>("missingAddons.ratingMin", null);
  const [gameModes, setGameModes] = useSessionState<string[]>("missingAddons.gameModes", []);
  const [gameModeExclude, setGameModeExclude] = useSessionState("missingAddons.gameModeExclude", false);
  const [collectionIds, setCollectionIds] = useSessionState<number[]>("missingAddons.collectionIds", []);
  const [collectionExclude, setCollectionExclude] = useSessionState("missingAddons.collectionExclude", false);
  const [franchiseIds, setFranchiseIds] = useSessionState<number[]>("missingAddons.franchiseIds", []);
  const [franchiseExclude, setFranchiseExclude] = useSessionState("missingAddons.franchiseExclude", false);
  const [formats, setFormats] = useSessionState<MediaFormat[]>("missingAddons.formats", []);
  const [formatExclude, setFormatExclude] = useSessionState("missingAddons.formatExclude", false);
  const [storefronts, setStorefronts] = useSessionState<string[]>("missingAddons.storefronts", []);
  const [storefrontExclude, setStorefrontExclude] = useSessionState("missingAddons.storefrontExclude", false);
  const [playStatuses, setPlayStatuses] = useSessionState<PlayStatus[]>("missingAddons.playStatuses", []);
  const [playStatusExclude, setPlayStatusExclude] = useSessionState("missingAddons.playStatusExclude", false);
  const [matchAll, setMatchAll] = useSessionState<MatchAllFilters>("missingAddons.matchAll", {});
  const [sort, setSort] = useSessionState<GameSortOption>("missingAddons.sort", "name_asc");

  const trimmedKeyword = searchKeyword.trim();
  const debouncedKeyword = useDebouncedValue(trimmedKeyword, 500);
  const isSearchActive = debouncedKeyword.length >= MIN_SEARCH_LENGTH;

  const { data: platforms = [], isSuccess: platformsLoaded } = useLibraryPlatforms();
  // Only the Platforms-page cards the library actually has — PC split per storefront the same
  // way — rather than every platform IGDB has ever attached to an imported game.
  const platformOptions = useMemo(
    () =>
      platforms.map((platform) => {
        const scope = { format: platform.format ?? undefined, storefront: platform.storefront ?? undefined };
        return { id: platformScopeKey(platform.id, scope), label: platformDisplayName(platform, scope, t) };
      }),
    [platforms, t]
  );
  const platformIdOptions = useMemo(() => platforms.map((platform) => ({ id: platform.id })), [platforms]);
  // An Insights row still presets plain platformIds; the toolbar edits both as one list of
  // card keys and writes them back as scopes.
  const platformKeys = useMemo(
    () => [...platformIds.map(String), ...platformScopes],
    [platformIds, platformScopes]
  );
  const setPlatformKeys = useCallback(
    (keys: string[]) => {
      setPlatformIds([]);
      setPlatformScopes(keys);
    },
    [setPlatformIds, setPlatformScopes]
  );
  const { data: tags = [], isSuccess: tagsLoaded } = useTags();
  const { data: collections = [], isSuccess: collectionsLoaded } = useCollections();
  const { data: franchises = [], isSuccess: franchisesLoaded } = useFranchises();
  usePruneStaleIds(platformIds, setPlatformIds, platformIdOptions, platformsLoaded);
  usePruneStaleIds(platformScopes, setPlatformScopes, platformOptions, platformsLoaded);
  usePruneStaleIds(tagIds, setTagIds, tags, tagsLoaded);
  usePruneStaleIds(collectionIds, setCollectionIds, collections, collectionsLoaded);
  usePruneStaleIds(franchiseIds, setFranchiseIds, franchises, franchisesLoaded);
  const { data: genres = [], isSuccess: genresLoaded } = useGenres();
  const { data: gameModeOptions = [] } = useGameModes();
  usePruneStaleIds(genreIds, setGenreIds, genres, genresLoaded);
  const { data: realStorefronts = [] } = useStorefronts();
  const storefrontOptions = useMemo(
    () => Array.from(new Set([...ALL_KNOWN_STOREFRONTS, ...realStorefronts])).sort(),
    [realStorefronts]
  );

  const filters = useMemo(
    () => ({
      search: isSearchActive ? debouncedKeyword : undefined,
      platformIds: platformIds.length > 0 ? platformIds : undefined,
      platformScopes: platformScopes.length > 0 ? platformScopes : undefined,
      platformExclude,
      tagIds: tagIds.length > 0 ? tagIds : undefined,
      tagExclude,
      genreIds: genreIds.length > 0 ? genreIds : undefined,
      genreExclude,
      releaseStatuses: releaseStatuses.length > 0 ? releaseStatuses : undefined,
      releaseYearFrom: releaseYearFrom ?? undefined,
      releaseYearTo: releaseYearTo ?? undefined,
      localPlayersMin: localPlayersMin ?? undefined,
      onlineMultiplayerOnly,
      coopOnly,
      timeToBeatMin: TIME_TO_BEAT_OPTIONS.find((option) => option.value === timeToBeat)?.min,
      timeToBeatMax: TIME_TO_BEAT_OPTIONS.find((option) => option.value === timeToBeat)?.max,
      ratingMin: ratingMin ?? undefined,
      gameModes: gameModes.length > 0 ? gameModes : undefined,
      gameModeExclude,
      collectionIds: collectionIds.length > 0 ? collectionIds : undefined,
      collectionExclude,
      franchiseIds: franchiseIds.length > 0 ? franchiseIds : undefined,
      franchiseExclude,
      // No categories/categoryExclude here — this page has no Game Types filter at all
      // (see hideGameTypesField below): everything shown is inherently an addon, so
      // filtering by main_game/bundle/etc would never match anything.
      formats: formats.length > 0 ? formats : undefined,
      formatExclude,
      storefronts: storefronts.length > 0 ? storefronts : undefined,
      storefrontExclude,
      // Filters on the owned parent game's progress, like formats/storefronts above filter
      // on its copies (see insight_repository.find_missing_addons).
      playStatuses: playStatuses.length > 0 ? playStatuses : undefined,
      playStatusExclude,
      matchAll,
      sort,
    }),
    [
      isSearchActive,
      debouncedKeyword,
      platformIds,
      platformScopes,
      platformExclude,
      tagIds,
      tagExclude,
      genreIds,
      genreExclude,
      releaseStatuses,
      releaseYearFrom,
      releaseYearTo,
      localPlayersMin,
      onlineMultiplayerOnly,
      coopOnly,
      timeToBeat,
      ratingMin,
      gameModes,
      gameModeExclude,
      collectionIds,
      collectionExclude,
      franchiseIds,
      franchiseExclude,
      formats,
      formatExclude,
      storefronts,
      storefrontExclude,
      playStatuses,
      playStatusExclude,
      matchAll,
      sort,
    ]
  );

  const { data: entries } = useMissingAddons(filters);

  // Ownership is never sent server-side (see GameList.tsx/CatalogBrowseGrid.tsx's identical
  // client-side treatment) — here it narrows each entry's addons rather than a flat list, so
  // a group whose addons are all filtered out drops out entirely instead of showing an empty
  // addon grid under its game's name.
  const visibleEntries = useMemo(() => {
    if (!entries) return [];
    if (ownershipStatuses.length === 0) return entries;
    return entries
      .map((entry) => ({
        ...entry,
        missingAddons: entry.missingAddons.filter((addon) =>
          matchesOwnership(addon, ownershipStatuses, ownershipExclude, matchAll.ownership)
        ),
      }))
      .filter((entry) => entry.missingAddons.length > 0);
  }, [entries, ownershipStatuses, ownershipExclude, matchAll.ownership]);

  return (
    <>
      <Box sx={{ mb: 3 }}>
        <GameListToolbar
          searchKeyword={searchKeyword}
          onSearchKeywordChange={setSearchKeyword}
          ownershipStatuses={ownershipStatuses}
          onOwnershipStatusesChange={setOwnershipStatuses}
          ownershipExclude={ownershipExclude}
          onOwnershipExcludeChange={setOwnershipExclude}
          platformOptions={platformOptions}
          platformKeys={platformKeys}
          onPlatformKeysChange={setPlatformKeys}
          platformExclude={platformExclude}
          onPlatformExcludeChange={setPlatformExclude}
          tagOptions={tags}
          tagIds={tagIds}
          onTagIdsChange={setTagIds}
          tagExclude={tagExclude}
          genreOptions={genres}
          genreIds={genreIds}
          onGenreIdsChange={setGenreIds}
          genreExclude={genreExclude}
          onGenreExcludeChange={setGenreExclude}
          releaseStatuses={releaseStatuses}
          onReleaseStatusesChange={setReleaseStatuses}
          releaseYearFrom={releaseYearFrom}
          onReleaseYearFromChange={setReleaseYearFrom}
          releaseYearTo={releaseYearTo}
          onReleaseYearToChange={setReleaseYearTo}
          localPlayersMin={localPlayersMin}
          onLocalPlayersMinChange={setLocalPlayersMin}
          onlineMultiplayerOnly={onlineMultiplayerOnly}
          onOnlineMultiplayerOnlyChange={setOnlineMultiplayerOnly}
          coopOnly={coopOnly}
          onCoopOnlyChange={setCoopOnly}
          timeToBeat={timeToBeat}
          onTimeToBeatChange={setTimeToBeat}
          ratingMin={ratingMin}
          onRatingMinChange={setRatingMin}
          gameModeOptions={gameModeOptions}
          gameModes={gameModes}
          onGameModesChange={setGameModes}
          gameModeExclude={gameModeExclude}
          onGameModeExcludeChange={setGameModeExclude}
          onTagExcludeChange={setTagExclude}
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
          gameTypes={[]}
          onGameTypesChange={() => {}}
          gameTypeExclude={false}
          onGameTypeExcludeChange={() => {}}
          hideGameTypesField
          formats={formats}
          onFormatsChange={setFormats}
          formatExclude={formatExclude}
          onFormatExcludeChange={setFormatExclude}
          storefrontOptions={storefrontOptions}
          storefronts={storefronts}
          onStorefrontsChange={setStorefronts}
          storefrontExclude={storefrontExclude}
          onStorefrontExcludeChange={setStorefrontExclude}
          sort={sort}
          onSortChange={setSort}
          playStatuses={playStatuses}
          onPlayStatusesChange={setPlayStatuses}
          playStatusExclude={playStatusExclude}
          onPlayStatusExcludeChange={setPlayStatusExclude}
          matchAll={matchAll}
          onMatchAllChange={setMatchAll}
        />
      </Box>
      {!entries || entries.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {t("insights.missingAddons.noneFound")}
        </Typography>
      ) : visibleEntries.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: "center" }}>{t("games.listToolbar.noSearchMatches")}</Paper>
      ) : (
        <VirtualList
          items={visibleEntries}
          getKey={(entry) => entry.game.id}
          estimateSize={() => 280}
          gap={24}
          renderItem={(entry) => (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                {entry.game.name}
              </Typography>
              {/* Fixed 16px gap at every breakpoint, matching VirtualGameGrid/CardCarousel's own
                  GRID_GAP_PX — keeps this grid's card width consistent with every other GameCard
                  surface, not just its own column counts. */}
              <Grid container spacing={2}>
                {entry.missingAddons.map((addon) => (
                  <Grid key={addon.id} size={{ xs: 6, sm: 4, md: 3, lg: 2 }}>
                    <GameCard
                      game={addon}
                      context="addon"
                      contextFunction={() => navigate(`/addon/${gameIdentifier(addon)}`)}
                    />
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}
        />
      )}
    </>
  );
};

export default MissingAddonsSection;
