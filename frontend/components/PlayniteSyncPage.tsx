import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import FormControlLabel from "@mui/material/FormControlLabel";
import LinearProgress from "@mui/material/LinearProgress";
import Paper from "@mui/material/Paper";
import Switch from "@mui/material/Switch";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TablePagination from "@mui/material/TablePagination";
import TableRow from "@mui/material/TableRow";
import TableSortLabel from "@mui/material/TableSortLabel";
import TextField from "@mui/material/TextField";
import Toolbar from "@mui/material/Toolbar";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import RefreshIcon from "@mui/icons-material/Refresh";
import SyncIcon from "@mui/icons-material/Sync";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { isAxiosError } from "axios";
import type { PlayniteEntry } from "../api/playnite";
import {
  useClearPlayniteCache,
  useIgnorePlayniteEntry,
  usePlayniteConfig,
  usePlayniteEntries,
  useScanPlaynite,
  useSyncPlayniteEntries,
  useUnignorePlayniteEntry,
} from "../hooks/usePlaynite";
import ConfirmDialog from "./ConfirmDialog";
import SettingsSubNav from "./SettingsSubNav";
import { TOAST_OPTIONS } from "../utils/toastOptions";

const isEntryActionable = (entry: PlayniteEntry) =>
  !entry.dismissed && (entry.status === "new" || entry.status === "no_match");

// Tags that map to the edition field (mirrors backend EDITION_TAGS).
const EDITION_TAGS = new Set([
  "counterfeit",
  "freetoplay",
  "gamepass",
  "games with gold",
  "japanese",
  "c64 mini",
  "playstation classic",
  "playstation+",
  "stadia pro",
  "snes classic",
  "nes classic",
  "quest+",
  "vr",
  "wii u roms",
  "3ds roms",
  "sega genesis mini",
  "sega genesis mini 2",
  "second account",
]);

const tagsToEdition = (tags: string | null): string => {
  if (!tags) return "—";
  const matched = tags
    .split(",")
    .map((t) => t.trim())
    .filter((t) => EDITION_TAGS.has(t.toLowerCase()));
  return matched.length > 0 ? matched.join(", ") : "—";
};

const tagsToFormats = (tags: string | null): string => {
  const lower = (tags ?? "").toLowerCase().split(",").map((t) => t.trim());
  const hasPhysical = lower.some((t) => t.includes("physical"));
  const hasDigital = lower.some((t) => t.includes("digital"));
  if (hasPhysical && hasDigital) return "Physical, Digital";
  if (hasPhysical) return "Physical";
  return "Digital";
};

const PlayniteSyncPage = () => {
  const { t } = useTranslation();
  const { data: config } = usePlayniteConfig();
  const { data: entries, isLoading } = usePlayniteEntries(!!config?.smbPath);
  const scan = useScanPlaynite();
  const clearCache = useClearPlayniteCache();
  const syncEntries = useSyncPlayniteEntries();
  const ignoreEntry = useIgnorePlayniteEntry();
  const unignoreEntry = useUnignorePlayniteEntry();

  const [search, setSearch] = useState("");
  const [hideSynced, setHideSynced] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const [confirmIds, setConfirmIds] = useState<string[] | null>(null);
  const [syncProgress, setSyncProgress] = useState<{ done: number; total: number } | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  type SortKey = "name" | "platform" | "edition" | "format" | "status";
  const [sortBy, setSortBy] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const handleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortDir("asc");
    }
    setPage(0);
  };

  const sortValue = (e: PlayniteEntry, key: SortKey): string => {
    switch (key) {
      case "name":
        return e.playniteName.toLowerCase();
      case "platform":
        return (e.playnitePlatform ?? "").toLowerCase();
      case "edition":
        return tagsToEdition(e.playniteTags).toLowerCase();
      case "format":
        return tagsToFormats(e.playniteTags).toLowerCase();
      case "status":
        return e.status;
    }
  };

  const filtered = useMemo(() => {
    let list = entries ?? [];
    if (hideSynced) {
      list = list.filter((e) => e.status !== "up_to_date");
    }
    const trimmed = search.trim().toLowerCase();
    if (trimmed) {
      list = list.filter((e) => e.playniteName.toLowerCase().includes(trimmed));
    }
    return list;
  }, [entries, hideSynced, search]);

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const va = sortValue(a, sortBy);
      const vb = sortValue(b, sortBy);
      if (va < vb) return -dir;
      if (va > vb) return dir;
      return 0;
    });
  }, [filtered, sortBy, sortDir]);

  const paged = useMemo(() => {
    const start = page * rowsPerPage;
    return sorted.slice(start, start + rowsPerPage);
  }, [sorted, page, rowsPerPage]);

  const actionableRows = useMemo(() => filtered.filter(isEntryActionable), [filtered]);
  const actionablePageRows = useMemo(() => paged.filter(isEntryActionable), [paged]);

  const selectedOnPage = paged.filter((e) => selectedSet.has(e.playniteId));
  const pageFullySelected =
    actionablePageRows.length > 0 &&
    actionablePageRows.every((e) => selectedSet.has(e.playniteId));

  const toggleSelectAll = () => {
    if (pageFullySelected) {
      setSelected((prev) => prev.filter((id) => !actionablePageRows.some((e) => e.playniteId === id)));
    } else {
      setSelected((prev) => [
        ...new Set([...prev, ...actionablePageRows.map((e) => e.playniteId)]),
      ]);
    }
  };

  const handleConfirmSync = async () => {
    if (!confirmIds || confirmIds.length === 0) return;
    const CHUNK_SIZE = 50;
    const total = confirmIds.length;
    setSyncProgress({ done: 0, total });
    let done = 0;
    try {
      for (let i = 0; i < total; i += CHUNK_SIZE) {
        const chunk = confirmIds.slice(i, i + CHUNK_SIZE);
        await syncEntries.mutateAsync(chunk);
        done += chunk.length;
        setSyncProgress({ done, total });
      }
    } finally {
      setSelected((prev) => prev.filter((id) => !confirmIds.includes(id)));
      setConfirmIds(null);
      setSyncProgress(null);
    }
  };

  const statusChip = (entry: PlayniteEntry) => {
    if (entry.dismissed) {
      return <Chip size="small" label={t("settings.playniteSync.statusIgnored")} />;
    }
    switch (entry.status) {
      case "up_to_date":
        return <Chip size="small" color="success" label={t("settings.playniteSync.statusUpToDate")} />;
      case "new":
        return <Chip size="small" color="primary" label={t("settings.playniteSync.statusNew")} />;
      case "no_match":
        return <Chip size="small" color="warning" label={t("settings.playniteSync.statusNoMatch")} />;
      default:
        return null;
    }
  };

  const configured = !!config?.smbPath;

  return (
    <Box>
      <SettingsSubNav />
      <Typography variant="h4" component="h1" gutterBottom>
        {t("settings.playniteSync.title")}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {t("settings.playniteSync.description")}
      </Typography>

      {!configured ? (
        <Paper sx={{ p: 3, textAlign: "center" }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t("settings.playniteSync.notConfigured")}
          </Typography>
          <Button component={Link} to="/settings/integrations" variant="contained">
            {t("settings.playniteSync.goToIntegrations")}
          </Button>
        </Paper>
      ) : (
        <Paper>
          <Toolbar sx={{ gap: 1, flexWrap: "wrap" }}>
            <TextField
              size="small"
              label={t("settings.playniteSync.searchLabel")}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              sx={{ minWidth: 200 }}
            />
            <Button
              startIcon={<RefreshIcon />}
              onClick={() =>
                scan.mutate(undefined, {
                  onSuccess: (result) =>
                    toast.success(
                      t("settings.playniteSync.scanSuccess", {
                        scanned: result.scanned,
                        newCount: result.newCount,
                      }),
                      TOAST_OPTIONS
                    ),
                  onError: (error: unknown) => {
                    const detail =
                      isAxiosError<{ detail?: string }>(error) && error.response?.data?.detail;
                    toast.error(
                      detail || t("settings.playniteSync.scanError"),
                      TOAST_OPTIONS
                    );
                  },
                })
              }
              disabled={scan.isPending}
            >
              {scan.isPending
                ? t("settings.playniteSync.scanning")
                : t("settings.playniteSync.scanButton")}
            </Button>

            <Box sx={{ flexGrow: 1 }} />
            {selected.length > 0 ? (
              <Button
                startIcon={<SyncIcon />}
                onClick={() => setConfirmIds([...selected])}
                disabled={selected.length === 0 || syncEntries.isPending}
              >
                {t("settings.playniteSync.syncSelectedButton", { count: selected.length })}
              </Button>
            ) : (
              <Tooltip title={t("settings.playniteSync.hideSyncedTooltip")}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={hideSynced}
                      onChange={(e) => {
                        setHideSynced(e.target.checked);
                        setPage(0);
                      }}
                    />
                  }
                  label={t("settings.playniteSync.hideSyncedLabel")}
                  sx={{ mr: 0 }}
                />
              </Tooltip>
            )}
            <Button
              startIcon={<SyncIcon />}
              onClick={() => setConfirmIds(actionableRows.map((e) => e.playniteId))}
              disabled={actionableRows.length === 0 || syncEntries.isPending}
            >
              {t("settings.playniteSync.syncAllButton")}
            </Button>
          </Toolbar>

          {isLoading ? (
            <Box sx={{ p: 3, textAlign: "center" }}>{t("common.loading")}</Box>
          ) : filtered.length === 0 ? (
            <Box sx={{ p: 3, textAlign: "center", color: "text.secondary" }}>
              {entries?.length === 0
                ? t("settings.playniteSync.emptyState")
                : t("settings.playniteSync.noResults")}
            </Box>
          ) : (
            <>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox">
                        <Checkbox
                          indeterminate={selectedOnPage.length > 0 && !pageFullySelected}
                          checked={pageFullySelected}
                          onChange={toggleSelectAll}
                          disabled={actionablePageRows.length === 0}
                        />
                      </TableCell>
                      <TableCell>
                        <TableSortLabel
                          active={sortBy === "name"}
                          direction={sortBy === "name" ? sortDir : "asc"}
                          onClick={() => handleSort("name")}
                        >
                          {t("settings.playniteSync.columnName")}
                        </TableSortLabel>
                      </TableCell>
                      <TableCell>
                        <TableSortLabel
                          active={sortBy === "platform"}
                          direction={sortBy === "platform" ? sortDir : "asc"}
                          onClick={() => handleSort("platform")}
                        >
                          {t("settings.playniteSync.columnPlatform")}
                        </TableSortLabel>
                      </TableCell>
                      <TableCell>
                        <TableSortLabel
                          active={sortBy === "edition"}
                          direction={sortBy === "edition" ? sortDir : "asc"}
                          onClick={() => handleSort("edition")}
                        >
                          {t("settings.playniteSync.columnEdition")}
                        </TableSortLabel>
                      </TableCell>
                      <TableCell>
                        <TableSortLabel
                          active={sortBy === "format"}
                          direction={sortBy === "format" ? sortDir : "asc"}
                          onClick={() => handleSort("format")}
                        >
                          {t("settings.playniteSync.columnFormat")}
                        </TableSortLabel>
                      </TableCell>
                      <TableCell>{t("settings.playniteSync.columnNotes")}</TableCell>
                      <TableCell>
                        <TableSortLabel
                          active={sortBy === "status"}
                          direction={sortBy === "status" ? sortDir : "asc"}
                          onClick={() => handleSort("status")}
                        >
                          {t("settings.playniteSync.columnStatus")}
                        </TableSortLabel>
                      </TableCell>
                      <TableCell align="right">{t("settings.playniteSync.columnActions")}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {paged.map((entry) => (
                      <TableRow
                        key={entry.playniteId}
                        hover
                        selected={selectedSet.has(entry.playniteId)}
                      >
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={selectedSet.has(entry.playniteId)}
                            onChange={() =>
                              setSelected((prev) =>
                                prev.includes(entry.playniteId)
                                  ? prev.filter((id) => id !== entry.playniteId)
                                  : [...prev, entry.playniteId]
                              )
                            }
                            disabled={!isEntryActionable(entry)}
                          />
                        </TableCell>
                        <TableCell>
                          {entry.gameId ? (
                            <Link to={`/game/${entry.gameId}`}>{entry.playniteName}</Link>
                          ) : (
                            entry.playniteName
                          )}
                        </TableCell>
                        <TableCell>{entry.playnitePlatform ?? "—"}</TableCell>
                        <TableCell>{tagsToEdition(entry.playniteTags)}</TableCell>
                        <TableCell>{tagsToFormats(entry.playniteTags)}</TableCell>
                        <TableCell>{entry.playniteTags ?? "—"}</TableCell>
                        <TableCell>{statusChip(entry)}</TableCell>
                        <TableCell align="right">
                          {entry.dismissed ? (
                            <Button size="small" onClick={() => unignoreEntry.mutate(entry.playniteId)}>
                              {t("settings.playniteSync.unignoreButton")}
                            </Button>
                          ) : (
                            <Button size="small" onClick={() => ignoreEntry.mutate(entry.playniteId)}>
                              {t("settings.playniteSync.ignoreButton")}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePagination
                component="div"
                count={filtered.length}
                page={page}
                rowsPerPage={rowsPerPage}
                onPageChange={(_, p) => setPage(p)}
                onRowsPerPageChange={(e) => {
                  setRowsPerPage(parseInt(e.target.value, 10));
                  setPage(0);
                }}
                rowsPerPageOptions={[10, 25, 50, 100]}
              />
            </>
          )}
        </Paper>
      )}

      {syncProgress !== null && (
        <Paper sx={{ p: 2, mt: 2 }}>
          <Typography variant="body2" gutterBottom>
            {t("settings.playniteSync.syncingProgress", {
              done: syncProgress.done,
              total: syncProgress.total,
            })}
          </Typography>
          <LinearProgress
            variant="determinate"
            value={(syncProgress.done / syncProgress.total) * 100}
          />
        </Paper>
      )}

      <ConfirmDialog
        open={confirmIds !== null}
        title={t("settings.playniteSync.confirmTitle", { count: confirmIds?.length ?? 0 })}
        description={t("settings.playniteSync.confirmDescription")}
        confirmLabel={t("settings.playniteSync.confirmButton")}
        confirmDisabled={syncEntries.isPending || syncProgress !== null}
        onClose={() => setConfirmIds(null)}
        onConfirm={() => void handleConfirmSync()}
      />
    </Box>
  );
};

export default PlayniteSyncPage;
