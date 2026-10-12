import { useState } from "react";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { isAxiosError } from "axios";
import { useResetDatabase } from "../hooks/useSystem";
import { TOAST_OPTIONS } from "../utils/toastOptions";

const DatabaseResetSection = () => {
  const { t } = useTranslation();
  const resetDatabase = useResetDatabase();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");

  const confirmed = confirmation === "confirm";

  const openDialog = () => {
    setConfirmation("");
    setDialogOpen(true);
  };

  const handleReset = () => {
    resetDatabase.mutate("confirm", {
      onSuccess: (result) => {
        setDialogOpen(false);
        toast.success(
          t("settings.dangerZone.resetSuccess", {
            games: result.gamesDeleted,
            items: result.libraryItemsDeleted,
          }),
          TOAST_OPTIONS,
        );
      },
      onError: (error: unknown) => {
        const detail =
          isAxiosError(error) && error.response?.data?.detail
            ? String(error.response.data.detail)
            : t("settings.dangerZone.resetError");
        toast.error(detail, TOAST_OPTIONS);
      },
    });
  };

  return (
    <Box
      sx={{
        border: 1,
        borderColor: "error.main",
        borderRadius: 1,
        p: 2,
        mt: 1,
      }}
    >
      <Typography variant="subtitle1" color="error" gutterBottom>
        {t("settings.dangerZone.heading")}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t("settings.dangerZone.description")}
      </Typography>
      <Button
        variant="outlined"
        color="error"
        startIcon={<DeleteForeverIcon />}
        onClick={openDialog}
      >
        {t("settings.dangerZone.resetButton")}
      </Button>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
        <DialogTitle color="error">{t("settings.dangerZone.dialogTitle")}</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            {t("settings.dangerZone.dialogDescription")}
          </DialogContentText>
          <Alert severity="warning" sx={{ mb: 2 }}>
            {t("settings.dangerZone.dialogWarning")}
          </Alert>
          <TextField
            autoFocus
            fullWidth
            label={t("settings.dangerZone.confirmLabel")}
            placeholder="confirm"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            disabled={resetDatabase.isPending}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} color="primary">
            {t("common.cancel")}
          </Button>
          <Button
            onClick={handleReset}
            color="error"
            variant="contained"
            disabled={!confirmed || resetDatabase.isPending}
          >
            {resetDatabase.isPending
              ? t("settings.dangerZone.resetting")
              : t("settings.dangerZone.resetButton")}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DatabaseResetSection;
