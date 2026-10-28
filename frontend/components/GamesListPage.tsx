import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import CheckIcon from "@mui/icons-material/Check";
import DeleteIcon from "@mui/icons-material/Delete";
import DriveFileMoveIcon from "@mui/icons-material/DriveFileMove";
import EditIcon from "@mui/icons-material/Edit";
import FavoriteIcon from "@mui/icons-material/Favorite";
import SearchIcon from "@mui/icons-material/Search";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Collapse from "@mui/material/Collapse";
import FormControl from "@mui/material/FormControl";
import IconButton from "@mui/material/IconButton";
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
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { listAllLibraryItems } from "../api/library";
import { useBulkDeleteLibraryItems } from "../hooks/useLibrary";
import BulkEditLibraryItemsDialog from "./BulkEditLibraryItemsDialog";
import { Pill } from "./Detail";
import MoveLibraryItemDialog from "./MoveLibraryItemDialog";
import type { LibraryListItem } from "../api/types";
import { useDebouncedValue } from "../hooks/useDebouncedValue";

type SortColumn = "gameName" | "status" | "platformName" | "edition" | "format" | "notes";
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
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<number>>(new Set());
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [moveItem, setMoveItem] = useState<LibraryListItem | null>(null);
  const [bulkDeleteError, setBulkDeleteError] = useState<string | null>(null);
  const bulkDelete = useBulkDeleteLibraryItems();

  const handleBulkDelete = async () => {
    try {
      await bulkDelete.mutateAsync([...selectedIds]);
      setBulkDeleteOpen(false);
      setBulkDeleteError(null);
      setSelectedIds(new Set());
      // Deleting every item on the last page would otherwise leave `page`
      // pointing past the end of the shrunken list and render a blank table.
      setPage(0);
    } catch {
      setBulkDeleteError(t("games.listPage.bulkEdit.deleteError"));
    }
  };
  const debouncedSearch = useDebouncedValue(search.trim().toLowerCase(), 300);

  // Title only visible at the very top of the page
  const [isAtTop, setIsAtTop] = useState(true);
  useEffect(() => {
    const onScroll = () => setIsAtTop(window.scrollY < 10);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
      const words = debouncedSearch.split(/\s+/).filter(Boolean);
      result = result.filter((item) => {
        const haystack = [
          item.gameName,
          item.platformName ?? "",
          item.edition ?? "",
          item.format ?? "",
          item.notes ?? "",
        ]
          .join(" ")
          .toLowerCase();
        // Every word must appear somewhere (any order)
        return words.every((word) => haystack.includes(word));
      });
    }
    const sorted = [...result].sort((a, b) => {
      let aVal: string | null;
      let bVal: string | null;
      switch (sortColumn) {
        case "gameName":
          aVal = a.gameName;
          bVal = b.gameName;
          break;
        case "status":
          aVal = a.status;
          bVal = b.status;
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
    setSelectedIds(new Set());
  }, [debouncedSearch, platformFilter, formatFilter]);


  const paginatedItems = useMemo(() => {
    const start = page * rowsPerPage;
    return filteredAndSorted.slice(start, start + rowsPerPage);
  }, [filteredAndSorted, page, rowsPerPage]);

  const pageIds = paginatedItems.map((item) => item.id);
  const selectedOnPage = pageIds.filter((id) => selectedIds.has(id)).length;

  const togglePageSelection = (checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      pageIds.forEach((id) => (checked ? next.add(id) : next.delete(id)));
      return next;
    });
  };

  const toggleItemSelection = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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
    { key: "format", label: t("games.listPage.formatColumn") },
    { key: "edition", label: t("games.listPage.editionColumn") },
    { key: "status", label: t("games.listPage.statusColumn") },
    { key: "notes", label: t("games.listPage.notesColumn") },
  ];

  return (
    <>
      <Box
        sx={{
          position: "sticky",
          // Same header treatment as the collection pages: dock exactly under the
          // fixed AppBar (56px on phones, 64px on wider screens), flat, and the
          // search stays visible on scroll while only the title scrolls away.
          // Same rhythm as the games page: 4px here + the Paper's padding = 20px
          // above the search field, 16px below it to the first row.
          top: { xs: 56, sm: 64 },
          zIndex: 1,
          bgcolor: "background.default",
          pt: 0.5,
          pb: 2,
        }}
      >
        <Collapse in={isAtTop}>
          <Typography variant="h4" component="h1" gutterBottom sx={{ mt: 2 }}>
            {t("games.listPage.title")}
          </Typography>
          {!isLoading ? (
            <Typography variant="body2" color="text.secondary">
              {t(
                filteredAndSorted.length === 1
                  ? "catalog.refCard.gameCountSingular"
                  : "catalog.refCard.gameCountPlural",
                { count: filteredAndSorted.length }
              )}
            </Typography>
          ) : null}
        </Collapse>
        <Paper elevation={0} sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2 }}>
            <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", flexDirection: { xs: "column", sm: "row" } }}>
              <TextField
                label={t("games.listPage.searchLabel")}
                size="small"
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
              <FormControl size="small" sx={{ minWidth: 140, flex: 1 }}>
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
              <FormControl size="small" sx={{ minWidth: 140, flex: 1 }}>
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

      {error ? (
        <Paper sx={{ p: 3 }}>
          <Typography color="error">
            Failed to load games: {error instanceof Error ? error.message : "Unknown error"}
          </Typography>
        </Paper>
      ) : isLoading ? (
        <Paper sx={{ p: 3, textAlign: "center" }}>{t("common.loading")}</Paper>
      ) : filteredAndSorted.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: "center" }}>{t("games.listPage.emptyState")}</Paper>
      ) : (
        <>
          {selectedIds.size > 0 && (
            <Paper
              sx={{ px: 2, py: 1, display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}
            >
              <Typography variant="body2">
                {t("games.listPage.selectedCount", { count: selectedIds.size })}
              </Typography>
              <Button
                size="small"
                variant="contained"
                startIcon={<EditIcon />}
                onClick={() => setBulkEditOpen(true)}
              >
                {t("games.listPage.bulkEdit.editButton")}
              </Button>
              <Button size="small" onClick={() => setSelectedIds(new Set())}>
                {t("games.listPage.bulkEdit.clearButton")}
              </Button>
              <Button
                size="small"
                variant="contained"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={() => {
                  setBulkDeleteError(null);
                  setBulkDeleteOpen(true);
                }}
                sx={{ marginLeft: "auto" }}
              >
                {t("games.listPage.bulkEdit.deleteButton")}
              </Button>
            </Paper>
          )}
          <TableContainer
            component={Paper}
            // The 16px gap below the search comes from the sticky header's padding
            // when nothing is selected; with the selection bar showing, the bar
            // carries it instead (it sits between the search and this table).
            sx={{ mt: selectedIds.size > 0 ? 2 : 0, overflowX: "auto" }}
          >
          <Table stickyHeader sx={{ minWidth: 600 }}>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={pageIds.length > 0 && selectedOnPage === pageIds.length}
                    indeterminate={selectedOnPage > 0 && selectedOnPage < pageIds.length}
                    onChange={(event) => togglePageSelection(event.target.checked)}
                    slotProps={{ input: { "aria-label": t("games.listPage.bulkEdit.selectPage") } }}
                  />
                </TableCell>
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
                  <TableCell />

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

                  <TableCell padding="checkbox" onClick={(event) => event.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.has(item.id)}
                      onChange={() => toggleItemSelection(item.id)}
                      slotProps={{ input: { "aria-label": item.gameName } }}
                    />
                  </TableCell>
                  <TableCell>{item.gameName}</TableCell>
                  <TableCell>{item.platformName ?? "—"}</TableCell>
                  <TableCell>{item.format ?? "—"}</TableCell>
                  <TableCell>{item.edition ?? "—"}</TableCell>
                  <TableCell>
                    <Pill
                      small
                      tone={item.status === "owned" ? "owned" : "wishlist"}
                      icon={item.status === "owned" ? <CheckIcon /> : <FavoriteIcon />}
                    >
                      {item.status === "owned"
                        ? t("games.library.ownedChip")
                        : t("games.library.wishlistChip")}
                    </Pill>
                  </TableCell>
                  <TableCell>{item.notes ?? "—"}</TableCell>
                  <TableCell padding="checkbox" onClick={(event) => event.stopPropagation()}>
                    <Tooltip title={t("common.transfer")}>
                      <IconButton
                        size="small"
                        aria-label={t("common.transfer")}
                        onClick={() => setMoveItem(item)}
                      >
                        <DriveFileMoveIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
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
      <Dialog open={bulkDeleteOpen} onClose={() => setBulkDeleteOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>
          {t("games.listPage.bulkEdit.deleteTitle", { count: selectedIds.size })}
        </DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {bulkDeleteError && <Alert severity="error">{bulkDeleteError}</Alert>}
          <Typography>{t("games.listPage.bulkEdit.deleteWarning")}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkDeleteOpen(false)}>{t("common.cancel")}</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleBulkDelete}
            disabled={bulkDelete.isPending}
          >
            {t("games.listPage.bulkEdit.deleteConfirm")}
          </Button>
        </DialogActions>
      </Dialog>
      <BulkEditLibraryItemsDialog
        open={bulkEditOpen}
        itemIds={[...selectedIds]}
        onClose={() => setBulkEditOpen(false)}
        onApplied={() => {
          setBulkEditOpen(false);
          setSelectedIds(new Set());
        }}
      />
      {moveItem && (
        <MoveLibraryItemDialog
          open
          onClose={() => setMoveItem(null)}
          itemId={moveItem.id}
          itemLabel={
            moveItem.platformName
              ? `${moveItem.gameName} (${moveItem.platformName})`
              : moveItem.gameName
          }
          currentGameId={moveItem.gameId}
        />
      )}
    </>
  );
};

export default GamesListPage;
