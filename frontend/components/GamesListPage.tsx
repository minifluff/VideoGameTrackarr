import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import SearchIcon from "@mui/icons-material/Search";
import Box from "@mui/material/Box";
import Collapse from "@mui/material/Collapse";
import FormControl from "@mui/material/FormControl";
import InputAdornment from "@mui/material/InputAdornment";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TablePagination from "@mui/material/TablePagination";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TableSortLabel from "@mui/material/TableSortLabel";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { listAllLibraryItems } from "../api/library";
import GamesSubNav from "./GamesSubNav";
import type { LibraryListItem } from "../api/types";
import { useScrollDirection } from "../hooks/useScrollCollapse";
import { useDebouncedValue } from "../hooks/useDebouncedValue";

type SortColumn = "gameName" | "platformName" | "edition" | "format" | "notes";
type SortDirection = "asc" | "desc";

const GamesListPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [sortColumn, setSortColumn] = useState<SortColumn>("gameName");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [formatFilter, setFormatFilter] = useState<string>("all");
  const debouncedSearch = useDebouncedValue(search.trim().toLowerCase(), 300);

  // Hide search bar on scroll down, reappear on scroll up.
  const hideSearchBar = useScrollDirection(80);

  const {
    data: rawItems,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["library", "all-items"],
    queryFn: listAllLibraryItems,
  });
  // Defensive: ensure items is always an array (API might return unexpected shape)
  const items = Array.isArray(rawItems) ? rawItems : [];

  const platforms = useMemo(() => {
    const set = new Set<string>();
    items.forEach((item) => {
      if (item.platformName) set.add(item.platformName);
    });
    return Array.from(set).sort();
  }, [items]);

  const formats = useMemo(() => {
    const set = new Set<string>();
    items.forEach((item) => {
      if (item.format) set.add(item.format);
    });
    return Array.from(set).sort();
  }, [items]);

  const filteredAndSorted = useMemo(() => {
    let result = items;
    if (platformFilter !== "all") {
      result = result.filter((item) => item.platformName === platformFilter);
    }
    if (formatFilter !== "all") {
      result = result.filter((item) => item.format === formatFilter);
    }
    if (debouncedSearch) {
      result = result.filter(
        (item) =>
          item.gameName.toLowerCase().includes(debouncedSearch) ||
          (item.platformName?.toLowerCase().includes(debouncedSearch) ?? false) ||
          (item.edition?.toLowerCase().includes(debouncedSearch) ?? false) ||
          (item.notes?.toLowerCase().includes(debouncedSearch) ?? false)
      );
    }
    const sorted = [...result].sort((a, b) => {
      let aVal: string | null;
      let bVal: string | null;
      switch (sortColumn) {
        case "gameName":
          aVal = a.gameName;
          bVal = b.gameName;
          break;
        case "platformName":
          aVal = a.platformName;
          bVal = b.platformName;
          break;
        case "edition":
          aVal = a.edition;
          bVal = b.edition;
          break;
        case "format":
          aVal = a.format;
          bVal = b.format;
          break;
        case "notes":
          aVal = a.notes;
          bVal = b.notes;
          break;
      }
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDirection === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [items, debouncedSearch, sortColumn, sortDirection, platformFilter, formatFilter]);

  useEffect(() => {
    setPage(0);
  }, [debouncedSearch, platformFilter, formatFilter]);

  const paginatedItems = useMemo(() => {
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
    { key: "gameName", label: t("games.listPage.nameColumn") },
    { key: "platformName", label: t("games.listPage.platformColumn") },
    { key: "edition", label: t("games.listPage.editionColumn") },
    { key: "format", label: t("games.listPage.formatColumn") },
    { key: "notes", label: t("games.listPage.notesColumn") },
  ];

  return (
    <>
      <Box
        sx={{
          position: "sticky",
          top: (theme) => theme.mixins.toolbar.minHeight,
          zIndex: 1,
          bgcolor: "background.default",
          pt: hideSearchBar ? 0 : 0.5,
          pb: hideSearchBar ? 0 : 1,
          boxShadow: hideSearchBar ? "none" : "0 4px 8px -4px rgba(0, 0, 0, 0.2)",
        }}
      >
        <Collapse in={!hideSearchBar}>
          <GamesSubNav />
        </Collapse>
        <Collapse in={!hideSearchBar}>
          <Typography variant="h4" component="h1" gutterBottom sx={{ mt: 2 }}>
            {t("games.listPage.title")}
          </Typography>
        </Collapse>
        <Collapse in={!hideSearchBar}>
          <Paper sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2 }}>
            <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", flexDirection: { xs: "column", sm: "row" } }}>
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
              <FormControl sx={{ minWidth: 150 }}>
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
              <FormControl sx={{ minWidth: 150 }}>
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
          </Paper>
        </Collapse>
      </Box>

      {error ? (
        <Paper sx={{ p: 3 }}>
          <Typography color="error">
            Failed to load games: {error instanceof Error ? error.message : "Unknown error"}
          </Typography>
        </Paper>
      ) : isLoading ? (
        <Paper sx={{ p: 3, textAlign: "center", mt: 2 }}>{t("common.loading")}</Paper>
      ) : filteredAndSorted.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: "center", mt: 2 }}>{t("games.listPage.emptyState")}</Paper>
      ) : (
        <>
          <TableContainer component={Paper} sx={{ mt: 2, overflowX: "auto" }}>
          <Table stickyHeader sx={{ minWidth: 600 }}>
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
              {paginatedItems.map((item: LibraryListItem) => (
                <TableRow
                  key={item.id}
                  hover
                  sx={{ cursor: "pointer" }}
                  onClick={() => navigate(`/game/${item.gameUuid}`)}
                >

                  <TableCell>{item.gameName}</TableCell>
                  <TableCell>{item.platformName ?? "—"}</TableCell>
                  <TableCell>{item.edition ?? "—"}</TableCell>
                  <TableCell>{item.format ?? "—"}</TableCell>
                  <TableCell>{item.notes ?? "—"}</TableCell>
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

export default GamesListPage;
