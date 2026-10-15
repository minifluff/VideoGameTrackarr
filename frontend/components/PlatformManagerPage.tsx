import { useState } from "react";
import { isAxiosError } from "axios";
import StorageIcon from "@mui/icons-material/Storage";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import type { PlatformResponse } from "../api/types";
import { useCreatePlatform, useDeletePlatform, useMassMoveGames, usePlatforms, useUpdatePlatform } from "../hooks/usePlatforms";
import { TOAST_OPTIONS } from "../utils/toastOptions";
import ConfirmDialog from "./ConfirmDialog";
import EnhancedTable, { type HeadCell } from "./EnhancedTable";
import MassMovePlatformDialog from "./MassMovePlatformDialog";
import PlatformDialog from "./PlatformDialog";
import SettingsSubNav from "./SettingsSubNav";

const ROWS_PER_PAGE_OPTIONS = [10, 25, 50];

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

  const headCells: HeadCell[] = [
    { id: "name", numeric: false, disablePadding: false, label: t("settings.platformManager.nameColumn"), disableHeader: false },
    { id: "abbreviation", numeric: false, disablePadding: false, label: t("settings.platformManager.abbreviationColumn"), disableHeader: false },
    { id: "gameCount", numeric: true, disablePadding: false, label: t("settings.platformManager.gameCountColumn"), disableHeader: false },
    { id: "actions", numeric: false, disablePadding: true, label: t("common.actions"), disableHeader: true },
  ];

  const toTableRow = (platform: PlatformResponse) => ({
    id: platform.id,
    name: platform.name,
    abbreviation: platform.abbreviation ?? "—",
    gameCount: platform.gameCount,
  });

  const rows = (platforms ?? []).map(toTableRow);

  const handleAddClick = () => {
    setDialogPlatform(null);
    setDialogOpen(true);
  };

  const handleEditClick = (rowId: number) => {
    const platform = platforms?.find((candidate) => candidate.id === rowId);
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

  const handleDeleteClick = (selectedIds: number[]) => setSelectedPendingDelete(selectedIds);

  const handleDelete = async () => {
    if (selectedPendingDelete.length === 0) return;
    try {
      await Promise.all(selectedPendingDelete.map((id) => deletePlatform.mutateAsync(id)));
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
  const confirmTitle =
    deleteCount <= 1
      ? t("settings.platformManager.deleteConfirmTitle", { name: singlePlatform?.name ?? "" })
      : t("settings.platformManager.deleteConfirmTitle_bulk", { count: deleteCount });
  const confirmDescription =
    deleteCount <= 1
      ? t("settings.platformManager.deleteConfirmDescription", { name: singlePlatform?.name ?? "" })
      : t("settings.platformManager.deleteConfirmDescription_bulk", { count: deleteCount });

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

      <EnhancedTable
        rows={rows}
        headCells={headCells}
        tableName={t("nav.platformManager")}
        tableIcon={<StorageIcon color="secondary" />}
        onAddClick={handleAddClick}
        onEditClick={handleEditClick}
        onDeleteClick={handleDeleteClick}
        moveDirection="down"
        defaultRowsPerPage={10}
        rowsPerPageOptions={ROWS_PER_PAGE_OPTIONS}
      />

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
        title={confirmTitle}
        description={confirmDescription}
        confirmLabel={t("common.delete")}
        confirmColor="error"
        onClose={() => setSelectedPendingDelete([])}
        onConfirm={handleDelete}
      />
    </>
  );
};

export default PlatformManagerPage;
