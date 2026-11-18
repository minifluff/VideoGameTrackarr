import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { useSyncAcquiredDates } from "../hooks/useLibrary";

// Deliberately unlinked: this page holds one-off maintenance actions that
// don't belong in the sidebar. Reach it directly at /settings-hidden.
const HiddenSettingsPage = () => {
  const { t } = useTranslation();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [updated, setUpdated] = useState<number | null>(null);
  const [error, setError] = useState(false);
  const sync = useSyncAcquiredDates();

  const handleSync = async () => {
    setConfirmOpen(false);
    setError(false);
    try {
      const result = await sync.mutateAsync();
      setUpdated(result.updated);
    } catch {
      setError(true);
    }
  };

  return (
    <>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          {t("settings.hidden.title")}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t("settings.hidden.note")}
        </Typography>
      </Box>
      <Typography variant="h6" component="h2" gutterBottom>
        {t("settings.hidden.syncTitle")}
      </Typography>
      <Typography variant="body2" sx={{ mb: 2 }}>
        {t("settings.hidden.syncDescription")}
      </Typography>
      {updated !== null && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {t("settings.hidden.success", { count: updated })}
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {t("settings.hidden.error")}
        </Alert>
      )}
      <Button
        variant="contained"
        onClick={() => setConfirmOpen(true)}
        disabled={sync.isPending}
      >
        {t("settings.hidden.syncButton")}
      </Button>
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>{t("settings.hidden.confirmTitle")}</DialogTitle>
        <DialogContent>
          <DialogContentText>{t("settings.hidden.confirmText")}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>{t("common.cancel")}</Button>
          <Button variant="contained" onClick={handleSync}>
            {t("settings.hidden.sync")}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default HiddenSettingsPage;
