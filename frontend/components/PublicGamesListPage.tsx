import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import SearchIcon from "@mui/icons-material/Search";
import Box from "@mui/material/Box";
import FormControl from "@mui/material/FormControl";
import InputAdornment from "@mui/material/InputAdornment";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
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
import type { PublicGameSummary } from "../api/types";

type SortColumn = "name" | "platforms" | "formats" | "editions";
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
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [formatFilter, setFormatFilter] = useState<string>("all");
  const debouncedSearch = useDebouncedValue(search.trim().toLowerCase(), 300);

  const hideSearchBar = useScrollDirection(80);

  const { data: games = [], isLoading } = usePublicGames(token, {
    search: debouncedSearch || undefined,
  });

  const platforms = useMemo(() => {
    const set = new Set<string>();
    games.forEach((game) => {
      game.ownedPlatforms.forEach((p) => set.add(p));
    });
    return Array.from(set).sort();
  }, [games]);

  const formats = useMemo(() => {
    const set = new Set<string>();
    games.forEach((game) => {
      (game.ownedFormats ?? []).forEach((f) => set.add(f));
    });
    return Array.from(set).sort();
  }, [games]);

  const filteredAndSorted = useMemo(() => {
    let result = games;
    if (platformFilter !== "all") {
      result = result.filter((game) => game.ownedPlatforms.includes(platformFilter));
    }
    if (formatFilter !== "all") {
      result = result.filter((game) => (game.ownedFormats ?? []).includes(formatFilter));
    }
    if (debouncedSearch) {
      const words = debouncedSearch.split(/\s+/).filter(Boolean);
      result = result.filter((game) => {
        const haystack = [game.name, ...game.ownedPlatforms, ...(game.ownedFormats ?? []), ...(game.ownedEditions ?? [])].join(" ").toLowerCase();
        return words.every((word) => haystack.includes(word));
      });
    }
    return [...result].sort((a, b) => {
      let aVal: string;
      let bVal: string;
      if (sortColumn === "name") {
        aVal = a.name;
        bVal = b.name;
      } else if (sortColumn === "platforms") {
        aVal = a.ownedPlatforms.join(", ");
        bVal = b.ownedPlatforms.join(", ");
      } else if (sortColumn === "formats") {
        aVal = (a.ownedFormats ?? []).join(", ");
        bVal = (b.ownedFormats ?? []).join(", ");
      } else {
        aVal = (a.ownedEditions ?? []).join(", ");
        bVal = (b.ownedEditions ?? []).join(", ");
      }
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDirection === "asc" ? cmp : -cmp;
    });
  }, [games, debouncedSearch, sortColumn, sortDirection, platformFilter, formatFilter]);

  useEffect(() => {
    setPage(0);
  }, [debouncedSearch, platformFilter, formatFilter]);

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
    { key: "formats", label: t("games.listPage.formatColumn") },
    { key: "editions", label: t("games.listPage.editionColumn") },
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
        <Typography variant="h4" component="h1" gutterBottom>
          {t("public.gamesList.title")}
        </Typography>
        <Box sx={{ display: hideSearchBar ? "none" : "block" }}>
          <Paper sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2 }}>
            <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
              <TextField
                label={t("games.listPage.searchLabel")}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                sx={{ flexGrow: 1, minWidth: 200 }}
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
              <Box sx={{ display: "flex", gap: 2, flex: { xs: "1 1 100%", sm: "0 1 auto" } }}>
                <FormControl sx={{ minWidth: 140, flex: 1 }}>
                  <InputLabel>{t("games.listPage.platformColumn")}</InputLabel>
                  <Select
                    value={platformFilter}
                    label={t("games.listPage.platformColumn")}
                    onChange={(e) => setPlatformFilter(e.target.value)}
                  >
                    <MenuItem value="all">{t("common.all")}</MenuItem>
                    {platforms.map((p) => (
                      <MenuItem key={p} value={p}>{p}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl sx={{ minWidth: 140, flex: 1 }}>
                  <InputLabel>{t("games.listPage.formatColumn")}</InputLabel>
                  <Select
                    value={formatFilter}
                    label={t("games.listPage.formatColumn")}
                    onChange={(e) => setFormatFilter(e.target.value)}
                  >
                    <MenuItem value="all">{t("common.all")}</MenuItem>
                    {formats.map((f) => (
                      <MenuItem key={f} value={f}>{f}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
            </Box>
          </Paper>
        </Box>
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
                    <TableCell>{(game.ownedFormats ?? []).join(", ") || "—"}</TableCell>
                    <TableCell>{(game.ownedEditions ?? []).join(", ") || "—"}</TableCell>
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
