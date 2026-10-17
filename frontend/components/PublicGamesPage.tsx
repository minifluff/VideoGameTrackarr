import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import type { GameSortOption } from "../api/types";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useScrollDirection } from "../hooks/useScrollCollapse";
import { usePublicGames, usePublicPlatforms, usePublicTags } from "../hooks/usePublic";
import { useSessionState } from "../hooks/useSessionState";
import GameCard from "./GameCard";
import PublicGamesToolbar, { type OwnershipStatus } from "./PublicGamesToolbar";
import VirtualGameGrid from "./VirtualGameGrid";

const PublicGamesPage = () => {
  const { token } = useParams<{ token: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  // Session-remembered (like sort) so coming back from a game's page restores the list.
  const [search, setSearch] = useSessionState("public.games.search", "");
  const [sort, setSort] = useSessionState<GameSortOption>("public.games.sort", "name_asc");
  const [platformIds, setPlatformIds] = useSessionState<number[]>("public.games.platformIds", []);
  const [tagIds, setTagIds] = useSessionState<number[]>("public.games.tagIds", []);
  const [formats, setFormats] = useSessionState<string[]>("public.games.formats", []);
  const [playStatuses, setPlayStatuses] = useSessionState<string[]>("public.games.playStatuses", []);
  const [ownershipStatuses, setOwnershipStatuses] = useSessionState<OwnershipStatus[]>("public.games.ownershipStatuses", []);
  const debouncedSearch = useDebouncedValue(search.trim(), 500);
  // Hide on scroll down, reappear on scroll up — same as the public list page.
  const hideSearchBar = useScrollDirection(80);
  const { data: allGames, isLoading } = usePublicGames(token, {
    search: debouncedSearch || undefined,
    sort,
    platformIds,
    tagIds,
    formats,
    playStatuses,
  });
  const { data: platforms = [] } = usePublicPlatforms(token);
  const { data: tags = [] } = usePublicTags(token);

  // Ownership filter is applied client-side (owned/wishlisted arrive on every public game).
  const games = useMemo(() => {
    if (!allGames || ownershipStatuses.length === 0) return allGames;
    return allGames.filter((game) => {
      const has = (status: OwnershipStatus) => (status === "owned" ? game.owned : game.wishlisted);
      return ownershipStatuses.some(has);
    });
  }, [allGames, ownershipStatuses]);

  const hasActiveFilters =
    debouncedSearch !== "" ||
    sort !== "name_asc" ||
    platformIds.length > 0 ||
    tagIds.length > 0 ||
    formats.length > 0 ||
    playStatuses.length > 0 ||
    ownershipStatuses.length > 0;

  const clearAllFilters = () => {
    setSearch("");
    setSort("name_asc");
    setPlatformIds([]);
    setTagIds([]);
    setFormats([]);
    setPlayStatuses([]);
    setOwnershipStatuses([]);
  };


  return (
    <>
      <Box
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 1,
          bgcolor: "background.default",
          pt: hideSearchBar ? 0 : 0.5,
          pb: hideSearchBar ? 0 : 1,
        }}
      >
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 2 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          {t("public.games.title")}
        </Typography>
        <Button
          variant={sort === "date_added_desc" ? "contained" : "outlined"}
          color={sort === "date_added_desc" ? "secondary" : "primary"}
          onClick={() => setSort(sort === "date_added_desc" ? "name_asc" : "date_added_desc")}
          sx={{ flexShrink: 0 }}
        >
          {t("games.list.newestButton")}
        </Button>
      </Box>
        <PublicGamesToolbar
        search={search}
        onSearchChange={setSearch}
        sort={sort}
        onSortChange={setSort}
        platformOptions={platforms}
        platformIds={platformIds}
        onPlatformIdsChange={setPlatformIds}
        tagOptions={tags}
        tagIds={tagIds}
        onTagIdsChange={setTagIds}

        formats={formats}
        onFormatsChange={setFormats}
        playStatuses={playStatuses}
        onPlayStatusesChange={setPlayStatuses}
        ownershipStatuses={ownershipStatuses}
        onOwnershipStatusesChange={setOwnershipStatuses}

      />
      </Box>
      {isLoading ? (
        <Paper sx={{ p: 3, textAlign: "center" }}>{t("common.loading")}</Paper>
      ) : !games || games.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: "center" }}>
          <Typography gutterBottom>{t("public.games.emptyState")}</Typography>
          {hasActiveFilters && (
            <Button variant="outlined" onClick={clearAllFilters} sx={{ mt: 1 }}>
              {t("games.listToolbar.clearFiltersButton")}
            </Button>
          )}
        </Paper>
      ) : (
        <VirtualGameGrid
          items={games}
          getKey={(game) => game.id}
          renderItem={(game) => (
            <Box>
              <GameCard
                game={game}
                context="public"
                contextFunction={() => navigate(`/public/${token}/games/${game.id}`)}
              />
              {game.ownedPlatforms.length > 0 && (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 1, justifyContent: "center" }}>
                  {game.ownedPlatforms.map((platform) => (
                    <Chip key={platform} label={platform} size="small" variant="outlined" />
                  ))}
                </Box>
              )}
            </Box>
          )}
        />
      )}
    </>
  );
};

export default PublicGamesPage;
