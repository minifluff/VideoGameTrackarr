import { useState } from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import type { PlatformResponse } from "../api/types";

interface MassMovePlatformDialogProps {
  open: boolean;
  platforms: PlatformResponse[];
  onClose: () => void;
  onConfirm: (sourceId: number, targetId: number) => void;
  isPending: boolean;
}

const MassMovePlatformDialog = ({ open, platforms, onClose, onConfirm, isPending }: MassMovePlatformDialogProps) => {
  const { t } = useTranslation();
  const [sourceId, setSourceId] = useState<number | "">("");
  const [targetId, setTargetId] = useState<number | "">("");

  const sourcePlatform = platforms.find((p) => p.id === sourceId);
  const targetPlatform = platforms.find((p) => p.id === targetId);
  const canConfirm = sourceId !== "" && targetId !== "" && sourceId !== targetId;

  const handleClose = () => {
    setSourceId("");
    setTargetId("");
    onClose();
  };

  const handleConfirm = () => {
    if (canConfirm) {
      onConfirm(sourceId as number, targetId as number);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t("settings.platformManager.massMoveTitle")}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            {t("settings.platformManager.massMoveDescription")}
          </Typography>
          <FormControl fullWidth>
            <InputLabel>{t("settings.platformManager.massMoveSource")}</InputLabel>
            <Select
              value={sourceId}
              label={t("settings.platformManager.massMoveSource")}
              onChange={(e) => setSourceId(e.target.value as number)}
            >
              {platforms.map((p) => (
                <MenuItem key={p.id} value={p.id} disabled={p.id === targetId}>
                  {p.name} ({p.gameCount} {t("settings.platformManager.gamesColumn")})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth>
            <InputLabel>{t("settings.platformManager.massMoveTarget")}</InputLabel>
            <Select
              value={targetId}
              label={t("settings.platformManager.massMoveTarget")}
              onChange={(e) => setTargetId(e.target.value as number)}
            >
              {platforms.map((p) => (
                <MenuItem key={p.id} value={p.id} disabled={p.id === sourceId}>
                  {p.name} ({p.gameCount} {t("settings.platformManager.gamesColumn")})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {sourcePlatform && targetPlatform && (
            <Typography variant="body2" color="warning.main">
              {t("settings.platformManager.massMoveConfirm", {
                count: sourcePlatform.gameCount,
                source: sourcePlatform.name,
                target: targetPlatform.name,
              })}
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>{t("common.cancel")}</Button>
        <Button onClick={handleConfirm} variant="contained" disabled={!canConfirm || isPending}>
          {t("settings.platformManager.massMoveButton")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default MassMovePlatformDialog;
