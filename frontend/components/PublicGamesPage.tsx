import { useNavigate, useParams } from "react-router-dom";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import type { GameSortOption } from "../api/types";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { usePublicGames, usePublicPlatforms } from "../hooks/usePublic";
import { useSessionState } from "../hooks/useSessionState";
import GameCard from "./GameCard";
import PublicGamesToolbar from "./PublicGamesToolbar";
import VirtualGameGrid from "./VirtualGameGrid";

const PublicGamesPage = () => {
  const { token } = useParams<{ token: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  // Session-remembered (like sort) so coming back from a game's page restores the list.
  const [search, setSearch] = useSessionState("public.games.search", "");
  const [sort, setSort] = useSessionState<GameSortOption>("public.games.sort", "name_asc");
  const [platformIds, setPlatformIds] = useSessionState<number[]>("public.games.platformIds", []);
  const debouncedSearch = useDebouncedValue(search.trim(), 500);
  const { data: games, isLoading } = usePublicGames(token, debouncedSearch || undefined, sort, platformIds);
  const { data: platforms = [] } = usePublicPlatforms(token);

  return (
    <>
      <Typography variant="h4" component="h1" gutterBottom>
        {t("public.games.title")}
      </Typography>
      <PublicGamesToolbar
        search={search}
        onSearchChange={setSearch}
        sort={sort}
        onSortChange={setSort}
        platformOptions={platforms}
        platformIds={platformIds}
        onPlatformIdsChange={setPlatformIds}
      />
      {isLoading ? (
        <Paper sx={{ p: 3, textAlign: "center" }}>{t("common.loading")}</Paper>
      ) : !games || games.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: "center" }}>{t("public.games.emptyState")}</Paper>
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
