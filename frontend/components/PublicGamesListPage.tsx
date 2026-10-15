import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import SearchIcon from "@mui/icons-material/Search";
import Box from "@mui/material/Box";
import Collapse from "@mui/material/Collapse";
import InputAdornment from "@mui/material/InputAdornment";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TablePagination from "@mui/material/TablePagination";
import TableRow from "@mui/material/TableRow";
import TableSortLabel from "@mui/material/TableSortLabel";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { usePublicGames } from "../hooks/usePublic";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useScrollDirection } from "../hooks/useScrollCollapse";
import PublicSubNav from "./PublicSubNav";
import type { PublicGameSummary } from "../api/types";

type SortColumn = "name" | "platforms";
type SortDirection = "asc" | "desc";

const PublicGamesListPage = () => {
  const { token } = useParams<{ token: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [sortColumn, setSortColumn] = useState<SortColumn>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const debouncedSearch = useDebouncedValue(search.trim().toLowerCase(), 300);

  const hideSearchBar = useScrollDirection(80);
  const [isAtTop, setIsAtTop] = useState(true);
  useEffect(() => {
    const onScroll = () => setIsAtTop(window.scrollY < 10);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const { data: games = [], isLoading } = usePublicGames(token, {
    search: debouncedSearch || undefined,
  });

  const filteredAndSorted = useMemo(() => {
    let result = games;
    if (debouncedSearch) {
      const words = debouncedSearch.split(/\s+/).filter(Boolean);
      result = result.filter((game) => {
        const haystack = [game.name, ...game.ownedPlatforms].join(" ").toLowerCase();
        return words.every((word) => haystack.includes(word));
      });
    }
    return [...result].sort((a, b) => {
      let aVal: string;
      let bVal: string;
      if (sortColumn === "name") {
        aVal = a.name;
        bVal = b.name;
      } else {
        aVal = a.ownedPlatforms.join(", ");
        bVal = b.ownedPlatforms.join(", ");
      }
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDirection === "asc" ? cmp : -cmp;
    });
  }, [games, debouncedSearch, sortColumn, sortDirection]);

  useEffect(() => {
    setPage(0);
  }, [debouncedSearch]);

  const paginatedGames = useMemo(() => {
    const start = page * rowsPerPage;
    return filteredAndSorted.slice(start, start + rowsPerPage);
  }, [filteredAndSorted, page, rowsPerPage]);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const columns: { key: SortColumn; label: string }[] = [
    { key: "name", label: t("games.listPage.nameColumn") },
    { key: "platforms", label: t("games.listPage.platformColumn") },
  ];

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
        <Collapse in={isAtTop}>
          <PublicSubNav />
        </Collapse>
        <Collapse in={isAtTop}>
          <Typography variant="h4" component="h1" gutterBottom sx={{ mt: 2 }}>
            {t("public.gamesList.title")}
          </Typography>
        </Collapse>
        <Collapse in={!hideSearchBar}>
          <Paper sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2 }}>
            <TextField
              label={t("games.listPage.searchLabel")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              fullWidth
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                },
              }}
            />
          </Paper>
        </Collapse>
      </Box>

      {isLoading ? (
        <Paper sx={{ p: 3, textAlign: "center", mt: 2 }}>{t("common.loading")}</Paper>
      ) : filteredAndSorted.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: "center", mt: 2 }}>{t("games.listPage.emptyState")}</Paper>
      ) : (
        <>
          <TableContainer component={Paper} sx={{ mt: 2, overflowX: "auto" }}>
            <Table stickyHeader sx={{ minWidth: 400 }}>
              <TableHead>
                <TableRow>
                  {columns.map((col) => (
                    <TableCell key={col.key}>
                      <TableSortLabel
                        active={sortColumn === col.key}
                        direction={sortColumn === col.key ? sortDirection : "asc"}
                        onClick={() => handleSort(col.key)}
                      >
                        {col.label}
                      </TableSortLabel>
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedGames.map((game: PublicGameSummary) => (
                  <TableRow
                    key={game.id}
                    hover
                    sx={{ cursor: "pointer" }}
                    onClick={() => navigate(`/public/${token}/games/${game.id}`)}
                  >
                    <TableCell>{game.name}</TableCell>
                    <TableCell>{game.ownedPlatforms.join(", ") || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={filteredAndSorted.length}
            page={page}
            onPageChange={(_, newPage) => setPage(newPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
            rowsPerPageOptions={[25, 50, 100, 250]}
          />
        </>
      )}
    </>
  );
};

export default PublicGamesListPage;
