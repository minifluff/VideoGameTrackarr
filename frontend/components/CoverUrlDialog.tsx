import { useState } from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import TextField from "@mui/material/TextField";
import { useTranslation } from "react-i18next";

interface CoverUrlDialogProps {
  open: boolean;
  onSelect: (imageUrl: string) => void;
  onClose: () => void;
}

const CoverUrlDialog = ({ open, onSelect, onClose }: CoverUrlDialogProps) => {
  const { t } = useTranslation();
  const [url, setUrl] = useState("");
  const [error, setError] = useState(false);

  const handleClose = () => {
    setUrl("");
    setError(false);
    onClose();
  };

  const handleUse = () => {
    const trimmed = url.trim();
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new Error("unsupported protocol");
      }
      setError(false);
      onSelect(trimmed);
      handleClose();
    } catch {
      setError(true);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t("games.gameForm.coverUrlTitle")}</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          margin="dense"
          label={t("games.gameForm.coverUrlLabel")}
          placeholder={t("games.gameForm.coverUrlPlaceholder")}
          value={url}
          onChange={(event) => {
            setUrl(event.target.value);
            setError(false);
          }}
          error={error}
          helperText={error ? t("games.gameForm.coverUrlInvalid") : undefined}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              handleUse();
            }
          }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>{t("common.cancel")}</Button>
        <Button variant="contained" onClick={handleUse} disabled={!url.trim()}>
          {t("games.gameForm.coverUrlUseButton")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CoverUrlDialog;
