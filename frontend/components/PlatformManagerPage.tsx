import { useMemo, useState } from "react";
import { isAxiosError } from "axios";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import AddIcon from "@mui/icons-material/Add";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TablePagination from "@mui/material/TablePagination";
import TableRow from "@mui/material/TableRow";
import TableSortLabel from "@mui/material/TableSortLabel";
import Toolbar from "@mui/material/Toolbar";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import type { PlatformResponse } from "../api/types";
import { useCreatePlatform, useDeletePlatform, useMassMoveGames, usePlatforms, useUpdatePlatform } from "../hooks/usePlatforms";
import { TOAST_OPTIONS } from "../utils/toastOptions";
import ConfirmDialog from "./ConfirmDialog";
import MassMovePlatformDialog from "./MassMovePlatformDialog";
import PlatformDialog from "./PlatformDialog";
import SettingsSubNav from "./SettingsSubNav";

type SortKey = "name" | "abbreviation" | "gameCount" | "igdbId" | "slug";

const PlatformManagerPage = () => {
  const { t } = useTranslation();
  const { data: platforms } = usePlatforms();
  const createPlatform = useCreatePlatform();
  const updatePlatform = useUpdatePlatform();
  const deletePlatform = useDeletePlatform();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogPlatform, setDialogPlatform] = useState<PlatformResponse | null>(null);
  const [selectedPendingDelete, setSelectedPendingDelete] = useState<number[]>([]);
  const [massMoveOpen, setMassMoveOpen] = useState(false);
  const massMove = useMassMoveGames();

  const [selected, setSelected] = useState<number[]>([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
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

  const sorted = useMemo(() => {
    const list = [...(platforms ?? [])];
    const dir = sortDir === "asc" ? 1 : -1;
    return list.sort((a, b) => {
      let va: string | number;
      let vb: string | number;
      if (sortBy === "name") {
        va = a.name.toLowerCase();
        vb = b.name.toLowerCase();
      } else if (sortBy === "abbreviation") {
        va = (a.abbreviation ?? "").toLowerCase();
        vb = (b.abbreviation ?? "").toLowerCase();
      } else if (sortBy === "igdbId") {
        va = a.igdbId ?? -1;
        vb = b.igdbId ?? -1;
      } else if (sortBy === "slug") {
        va = (a.slug ?? "").toLowerCase();
        vb = (b.slug ?? "").toLowerCase();
      } else {
        va = a.gameCount;
        vb = b.gameCount;
      }
      if (va < vb) return -dir;
      if (va > vb) return dir;
      return 0;
    });
  }, [platforms, sortBy, sortDir]);

  const paged = useMemo(() => {
    const start = page * rowsPerPage;
    return sorted.slice(start, start + rowsPerPage);
  }, [sorted, page, rowsPerPage]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const allOnPageSelected = paged.length > 0 && paged.every((p) => selectedSet.has(p.id));

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelected((prev) => [...new Set([...prev, ...paged.map((p) => p.id)])]);
    } else {
      const pageIds = new Set(paged.map((p) => p.id));
      setSelected((prev) => prev.filter((id) => !pageIds.has(id)));
    }
  };

  const handleSelectOne = (id: number) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const handleAddClick = () => {
    setDialogPlatform(null);
    setDialogOpen(true);
  };

  const handleEditClick = (platformId: number) => {
    const platform = platforms?.find((candidate) => candidate.id === platformId);
    if (!platform) return;
    setDialogPlatform(platform);
    setDialogOpen(true);
  };

  const handleDialogSubmit = async (values: { name: string; abbreviation: string | null }) => {
    try {
      if (dialogPlatform) {
        await updatePlatform.mutateAsync({ platformId: dialogPlatform.id, ...values });
        toast.success(t("settings.platformManager.updateSuccess"), TOAST_OPTIONS);
      } else {
        await createPlatform.mutateAsync(values);
        toast.success(t("settings.platformManager.addSuccess"), TOAST_OPTIONS);
      }
      setDialogOpen(false);
    } catch (error) {
      console.error("Error saving platform:", error);
      const message =
        isAxiosError(error) && error.response?.status === 409
          ? t("settings.platformManager.duplicateNameError")
          : t("settings.platformManager.saveError");
      toast.error(message, TOAST_OPTIONS);
    }
  };

  const handleMassMove = async (sourceId: number, targetId: number) => {
    try {
      const result = await massMove.mutateAsync({ sourceId, targetId });
      toast.success(
        t("settings.platformManager.massMoveSuccess", { count: result.moved_count }),
        TOAST_OPTIONS
      );
      setMassMoveOpen(false);
    } catch (error) {
      console.error("Error moving games between platforms:", error);
      toast.error(t("settings.platformManager.massMoveError"), TOAST_OPTIONS);
    }
  };

  const handleDeleteSelected = () => {
    if (selected.length > 0) {
      setSelectedPendingDelete(selected);
    }
  };

  const handleDelete = async () => {
    if (selectedPendingDelete.length === 0) return;
    try {
      await Promise.all(selectedPendingDelete.map((id) => deletePlatform.mutateAsync(id)));
      setSelected((prev) => prev.filter((id) => !selectedPendingDelete.includes(id)));
    } catch (error) {
      console.error("Error deleting platform(s):", error);
      toast.error(t("settings.platformManager.deleteError"), TOAST_OPTIONS);
    } finally {
      setSelectedPendingDelete([]);
    }
  };

  const deleteCount = selectedPendingDelete.length;
  const singlePlatform =
    deleteCount === 1 ? platforms?.find((platform) => platform.id === selectedPendingDelete[0]) : undefined;

  const sortLabel = (key: SortKey, label: string) => (
    <TableSortLabel
      active={sortBy === key}
      direction={sortBy === key ? sortDir : "asc"}
      onClick={() => handleSort(key)}
    >
      {label}
    </TableSortLabel>
  );

  return (
    <>
      <SettingsSubNav />
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          {t("nav.platformManager")}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t("settings.platformManager.description")}
        </Typography>
        <Button variant="outlined" sx={{ mt: 2 }} onClick={() => setMassMoveOpen(true)}>
          {t("settings.platformManager.massMoveButton")}
        </Button>
      </Box>

      <Paper sx={{ width: "100%", mb: 2, borderRadius: 2 }}>
        <Toolbar sx={{ display: "flex", justifyContent: "space-between" }}>
          <Typography variant="h6">{t("nav.platformManager")}</Typography>
          <Box sx={{ display: "flex", gap: 1 }}>
            {selected.length > 0 && (
              <Tooltip title={t("common.delete")}>
                <IconButton onClick={handleDeleteSelected} color="error">
                  <DeleteIcon />
                </IconButton>
              </Tooltip>
            )}
            <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddClick}>
              {t("common.add")}
            </Button>
          </Box>
        </Toolbar>
        <TableContainer>
          <Table size="small" aria-label={t("nav.platformManager")}>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={allOnPageSelected}
                    indeterminate={selected.length > 0 && !allOnPageSelected}
                    onChange={handleSelectAll}
                  />
                </TableCell>
                <TableCell>{sortLabel("name", t("settings.platformManager.nameColumn"))}</TableCell>
                <TableCell>{sortLabel("slug", t("settings.platformManager.slugColumn"))}</TableCell>
                <TableCell align="right">{sortLabel("igdbId", t("settings.platformManager.igdbIdColumn"))}</TableCell>
                <TableCell>{sortLabel("abbreviation", t("settings.platformManager.abbreviationColumn"))}</TableCell>
                <TableCell align="right">{sortLabel("gameCount", t("settings.platformManager.gamesColumn"))}</TableCell>
                <TableCell align="right">{t("common.actions")}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paged.map((platform) => {
                const isSelected = selectedSet.has(platform.id);
                return (
                  <TableRow
                    key={platform.id}
                    hover
                    selected={isSelected}
                    sx={{ cursor: "pointer" }}
                    onClick={() => handleSelectOne(platform.id)}
                  >
                    <TableCell padding="checkbox">
                      <Checkbox checked={isSelected} />
                    </TableCell>
                    <TableCell>{platform.name}</TableCell>
                    <TableCell>{platform.slug ?? "—"}</TableCell>
                    <TableCell align="right">{platform.igdbId ?? "—"}</TableCell>
                    <TableCell>{platform.abbreviation ?? "—"}</TableCell>
                    <TableCell align="right">{platform.gameCount}</TableCell>
                    <TableCell align="right">
                      <Tooltip title={t("common.edit")}>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditClick(platform.id);
                          }}
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t("common.delete")}>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPendingDelete([platform.id]);
                          }}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={sorted.length}
          page={page}
          rowsPerPage={rowsPerPage}
          onPageChange={(_, p) => setPage(p)}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[10, 25, 50]}
        />
      </Paper>

      <PlatformDialog
        open={dialogOpen}
        title={dialogPlatform ? t("settings.platformManager.editDialogTitle") : t("settings.platformManager.addDialogTitle")}
        defaultValues={
          dialogPlatform ? { name: dialogPlatform.name, abbreviation: dialogPlatform.abbreviation } : undefined
        }
        onClose={() => setDialogOpen(false)}
        onSubmit={handleDialogSubmit}
        submitLabel={dialogPlatform ? t("common.save") : t("common.add")}
      />

      <MassMovePlatformDialog
        open={massMoveOpen}
        platforms={platforms ?? []}
        onClose={() => setMassMoveOpen(false)}
        onConfirm={handleMassMove}
        isPending={massMove.isPending}
      />

      <ConfirmDialog
        open={selectedPendingDelete.length > 0}
        title={
          deleteCount <= 1
            ? t("settings.platformManager.deleteConfirmTitle", { name: singlePlatform?.name ?? "" })
            : t("settings.platformManager.deleteConfirmTitle_bulk", { count: deleteCount })
        }
        description={
          deleteCount <= 1
            ? t("settings.platformManager.deleteConfirmDescription", { name: singlePlatform?.name ?? "" })
            : t("settings.platformManager.deleteConfirmDescription_bulk", { count: deleteCount })
        }
        confirmLabel={t("common.delete")}
        confirmColor="error"
        onClose={() => setSelectedPendingDelete([])}
        onConfirm={handleDelete}
      />
    </>
  );
};

export default PlatformManagerPage;
