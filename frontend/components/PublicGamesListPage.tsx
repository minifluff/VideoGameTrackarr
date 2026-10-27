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

type SortColumn = "name" | "platforms" | "formats" | "editions";
type SortDirection = "asc" | "desc";

interface ListRow {
  key: string;
  gameId: number;
  name: string;
  platform: string | null;
  format: string | null;
  edition: string | null;
}

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

  // One row per owned copy, so each platform gets its own line with its own
  // format and edition. Games with no owned copies get a single empty row.
  const rows = useMemo<ListRow[]>(() => {
    const result: ListRow[] = [];
    games.forEach((game) => {
      const copies = game.ownedCopies ?? [];
      if (copies.length === 0) {
        result.push({
          key: `${game.id}-none`,
          gameId: game.id,
          name: game.name,
          platform: null,
          format: null,
          edition: null,
        });
      } else {
        copies.forEach((copy, i) => {
          result.push({
            key: `${game.id}-${copy.platform ?? "?"}-${copy.format ?? "?"}-${copy.edition ?? "?"}-${i}`,
            gameId: game.id,
            name: game.name,
            platform: copy.platform,
            format: copy.format,
            edition: copy.edition,
          });
        });
      }
    });
    return result;
  }, [games]);

  const platforms = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((row) => {
      if (row.platform) set.add(row.platform);
    });
    return Array.from(set).sort();
  }, [rows]);

  const formats = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((row) => {
      if (row.format) set.add(row.format);
    });
    return Array.from(set).sort();
  }, [rows]);

  const filteredAndSorted = useMemo(() => {
    let result = rows;
    if (platformFilter !== "all") {
      result = result.filter((row) => row.platform === platformFilter);
    }
    if (formatFilter !== "all") {
      result = result.filter((row) => row.format === formatFilter);
    }
    if (debouncedSearch) {
      const words = debouncedSearch.split(/\s+/).filter(Boolean);
      result = result.filter((row) => {
        const haystack = [row.name, row.platform, row.format, row.edition]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
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
        aVal = a.platform ?? "";
        bVal = b.platform ?? "";
      } else if (sortColumn === "formats") {
        aVal = a.format ?? "";
        bVal = b.format ?? "";
      } else {
        aVal = a.edition ?? "";
        bVal = b.edition ?? "";
      }
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDirection === "asc" ? cmp : -cmp;
    });
  }, [rows, debouncedSearch, sortColumn, sortDirection, platformFilter, formatFilter]);

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
        {!isLoading ? (
          <Typography variant="body2" color="text.secondary">
            {t(
              games.length === 1
                ? "catalog.refCard.gameCountSingular"
                : "catalog.refCard.gameCountPlural",
              { count: games.length }
            )}
          </Typography>
        ) : null}
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
                {paginatedGames.map((row: ListRow) => (
                  <TableRow
                    key={row.key}
                    hover
                    sx={{ cursor: "pointer" }}
                    onClick={() => navigate(`/public/${token}/games/${row.gameId}`)}
                  >
                    <TableCell>{row.name}</TableCell>
                    <TableCell>{row.platform || "—"}</TableCell>
                    <TableCell>{row.format || "—"}</TableCell>
                    <TableCell>{row.edition || "—"}</TableCell>
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
