import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import SearchIcon from "@mui/icons-material/Search";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import InputAdornment from "@mui/material/InputAdornment";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
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

type SortColumn = "gameName" | "platformName" | "edition" | "format" | "firstReleaseDate" | "dateAdded";
type SortDirection = "asc" | "desc";

const GamesListPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [sortColumn, setSortColumn] = useState<SortColumn>("gameName");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const debouncedSearch = useDebouncedValue(search.trim().toLowerCase(), 300);

  // Hide search bar on scroll down, reappear on scroll up.
  const hideSearchBar = useScrollDirection(80);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["library", "all-items"],
    queryFn: listAllLibraryItems,
  });

  const filteredAndSorted = useMemo(() => {
    let result = items;
    if (debouncedSearch) {
      result = result.filter(
        (item) =>
          item.gameName.toLowerCase().includes(debouncedSearch) ||
          (item.platformName?.toLowerCase().includes(debouncedSearch) ?? false) ||
          (item.edition?.toLowerCase().includes(debouncedSearch) ?? false) ||
          item.tagNames.some((tag) => tag.toLowerCase().includes(debouncedSearch))
      );
    }
    const sorted = [...result].sort((a, b) => {
      let aVal: string | number | null;
      let bVal: string | number | null;
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
        case "firstReleaseDate":
          aVal = a.firstReleaseDate;
          bVal = b.firstReleaseDate;
          break;
        case "dateAdded":
          aVal = a.dateAdded;
          bVal = b.dateAdded;
          break;
      }
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDirection === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [items, debouncedSearch, sortColumn, sortDirection]);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const formatDate = (timestamp: number | null): string => {
    if (!timestamp) return "—";
    return new Date(timestamp * 1000).toLocaleDateString();
  };

  const formatDateAdded = (isoString: string): string => {
    return new Date(isoString).toLocaleDateString();
  };

  const columns: { key: SortColumn; label: string }[] = [
    { key: "gameName", label: t("games.listPage.nameColumn") },
    { key: "platformName", label: t("games.listPage.platformColumn") },
    { key: "edition", label: t("games.listPage.editionColumn") },
    { key: "format", label: t("games.listPage.formatColumn") },
    { key: "firstReleaseDate", label: t("games.listPage.releaseDateColumn") },
    { key: "dateAdded", label: t("games.listPage.dateAddedColumn") },
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
        <Box sx={{ display: hideSearchBar ? "none" : "block" }}>
          <GamesSubNav />
        </Box>
        <Typography variant="h4" component="h1" gutterBottom sx={{ display: hideSearchBar ? "none" : "block", mt: 2 }}>
          {t("games.listPage.title")}
        </Typography>
        <Box sx={{ display: hideSearchBar ? "none" : "block" }}>
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
        </Box>
      </Box>

      {isLoading ? (
        <Paper sx={{ p: 3, textAlign: "center", mt: 2 }}>{t("common.loading")}</Paper>
      ) : filteredAndSorted.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: "center", mt: 2 }}>{t("games.listPage.emptyState")}</Paper>
      ) : (
        <TableContainer component={Paper} sx={{ mt: 2 }}>
          <Table stickyHeader>
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
                <TableCell>{t("games.listPage.tagsColumn")}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredAndSorted.map((item: LibraryListItem) => (
                <TableRow
                  key={item.id}
                  hover
                  sx={{ cursor: "pointer" }}
                  onClick={() => navigate(`/games/${item.gameUuid}`)}
                >
                  <TableCell>{item.gameName}</TableCell>
                  <TableCell>{item.platformName ?? "—"}</TableCell>
                  <TableCell>{item.edition ?? "—"}</TableCell>
                  <TableCell>{item.format ?? "—"}</TableCell>
                  <TableCell>{formatDate(item.firstReleaseDate)}</TableCell>
                  <TableCell>{formatDateAdded(item.dateAdded)}</TableCell>
                  <TableCell>
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                      {item.tagNames.map((tag) => (
                        <Chip key={tag} label={tag} size="small" variant="outlined" />
                      ))}
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </>
  );
};

export default GamesListPage;
