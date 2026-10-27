import { useState } from "react";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";
import TimerOffIcon from "@mui/icons-material/TimerOff";
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
import { useClearMissingGames, useClearPlaytime, useResetDatabase } from "../hooks/useSystem";
import { TOAST_OPTIONS } from "../utils/toastOptions";

const DatabaseResetSection = () => {
  const { t } = useTranslation();
  const resetDatabase = useResetDatabase();
  const clearPlaytime = useClearPlaytime();
  const clearMissingGames = useClearMissingGames();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [playtimeDialogOpen, setPlaytimeDialogOpen] = useState(false);
  const [playtimeConfirmation, setPlaytimeConfirmation] = useState("");
  const [missingGamesDialogOpen, setMissingGamesDialogOpen] = useState(false);
  const [missingGamesConfirmation, setMissingGamesConfirmation] = useState("");

  const confirmed = confirmation === "confirm";
  const playtimeConfirmed = playtimeConfirmation === "confirm";
  const missingGamesConfirmed = missingGamesConfirmation === "confirm";

  const openDialog = () => {
    setConfirmation("");
    setDialogOpen(true);
  };

  const openPlaytimeDialog = () => {
    setPlaytimeConfirmation("");
    setPlaytimeDialogOpen(true);
  };

  const openMissingGamesDialog = () => {
    setMissingGamesConfirmation("");
    setMissingGamesDialogOpen(true);
  };

  const handleClearPlaytime = () => {
    clearPlaytime.mutate("confirm", {
      onSuccess: (result) => {
        setPlaytimeDialogOpen(false);
        toast.success(
          t("settings.dangerZone.clearPlaytimeSuccess", {
            progress: result.progressDeleted,
            sessions: result.sessionsDeleted,
          }),
          TOAST_OPTIONS,
        );
      },
      onError: (error: unknown) => {
        const detail =
          isAxiosError(error) && error.response?.data?.detail
            ? String(error.response.data.detail)
            : t("settings.dangerZone.clearPlaytimeError");
        toast.error(detail, TOAST_OPTIONS);
      },
    });
  };

  const handleClearMissingGames = () => {
    clearMissingGames.mutate("confirm", {
      onSuccess: (result) => {
        setMissingGamesDialogOpen(false);
        toast.success(
          t("settings.dangerZone.clearMissingGamesSuccess", {
            games: result.gamesDeleted,
          }),
          TOAST_OPTIONS,
        );
      },
      onError: (error: unknown) => {
        const detail =
          isAxiosError(error) && error.response?.data?.detail
            ? String(error.response.data.detail)
            : t("settings.dangerZone.clearMissingGamesError");
        toast.error(detail, TOAST_OPTIONS);
      },
    });
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
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
      <Button
        variant="outlined"
        color="error"
        startIcon={<DeleteForeverIcon />}
        onClick={openDialog}
      >
        {t("settings.dangerZone.resetButton")}
      </Button>
      <Button
        variant="outlined"
        color="error"
        startIcon={<TimerOffIcon />}
        onClick={openPlaytimeDialog}
      >
        {t("settings.dangerZone.clearPlaytimeButton")}
      </Button>
      <Button
        variant="outlined"
        color="error"
        startIcon={<DeleteSweepIcon />}
        onClick={openMissingGamesDialog}
      >
        {t("settings.dangerZone.clearMissingGamesButton")}
      </Button>
      </Box>

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

      <Dialog open={missingGamesDialogOpen} onClose={() => setMissingGamesDialogOpen(false)}>
        <DialogTitle color="error">{t("settings.dangerZone.clearMissingGamesDialogTitle")}</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            {t("settings.dangerZone.clearMissingGamesDialogDescription")}
          </DialogContentText>
          <Alert severity="warning" sx={{ mb: 2 }}>
            {t("settings.dangerZone.clearMissingGamesDialogWarning")}
          </Alert>
          <TextField
            autoFocus
            fullWidth
            label={t("settings.dangerZone.confirmLabel")}
            placeholder="confirm"
            value={missingGamesConfirmation}
            onChange={(e) => setMissingGamesConfirmation(e.target.value)}
            disabled={clearMissingGames.isPending}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMissingGamesDialogOpen(false)} color="primary">
            {t("common.cancel")}
          </Button>
          <Button
            onClick={handleClearMissingGames}
            color="error"
            variant="contained"
            disabled={!missingGamesConfirmed || clearMissingGames.isPending}
          >
            {clearMissingGames.isPending
              ? t("settings.dangerZone.clearing")
              : t("settings.dangerZone.clearMissingGamesButton")}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={playtimeDialogOpen} onClose={() => setPlaytimeDialogOpen(false)}>
        <DialogTitle color="error">{t("settings.dangerZone.clearPlaytimeDialogTitle")}</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            {t("settings.dangerZone.clearPlaytimeDialogDescription")}
          </DialogContentText>
          <Alert severity="warning" sx={{ mb: 2 }}>
            {t("settings.dangerZone.clearPlaytimeDialogWarning")}
          </Alert>
          <TextField
            autoFocus
            fullWidth
            label={t("settings.dangerZone.confirmLabel")}
            placeholder="confirm"
            value={playtimeConfirmation}
            onChange={(e) => setPlaytimeConfirmation(e.target.value)}
            disabled={clearPlaytime.isPending}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPlaytimeDialogOpen(false)} color="primary">
            {t("common.cancel")}
          </Button>
          <Button
            onClick={handleClearPlaytime}
            color="error"
            variant="contained"
            disabled={!playtimeConfirmed || clearPlaytime.isPending}
          >
            {clearPlaytime.isPending
              ? t("settings.dangerZone.clearing")
              : t("settings.dangerZone.clearPlaytimeButton")}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DatabaseResetSection;
