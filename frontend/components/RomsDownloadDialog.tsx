import { useState } from "react";
import { isAxiosError } from "axios";
import DownloadIcon from "@mui/icons-material/Download";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { resolveAssetUrl } from "../api/client";
import { createRomDownloadLink } from "../api/library";
import type { RomFileSummary } from "../api/types";
import { downloadFromUrl } from "../utils/download";
import { formatFileSize } from "../utils/roms";
import { TOAST_OPTIONS } from "../utils/toastOptions";

interface RomsDownloadDialogProps {
  open: boolean;
  gameName: string;
  roms: RomFileSummary[];
  onClose: () => void;
}

// The ROM files stored on this server for one copy, each with its own
// Download — opened from the copy's download icon on the game page, the same
// way the GOG copy's icon opens its offline installers. The edit dialog
// shows the same files with upload, label and delete; this one is
// download-only.
const RomsDownloadDialog = ({ open, gameName, roms, onClose }: RomsDownloadDialogProps) => {
  const { t } = useTranslation();
  const [downloadingRomId, setDownloadingRomId] = useState<number | null>(null);

  const handleDownload = async (rom: RomFileSummary) => {
    setDownloadingRomId(rom.id);
    try {
      const url = await createRomDownloadLink(rom.id);
      downloadFromUrl(resolveAssetUrl(url) ?? url);
    } catch (error) {
      console.error("Error downloading ROM:", error);
      const detail = isAxiosError<{ detail?: string }>(error) ? error.response?.data?.detail : undefined;
      toast.error(
        typeof detail === "string" ? detail : t("dialogs.libraryItem.romDownloadError"),
        TOAST_OPTIONS
      );
    } finally {
      setDownloadingRomId(null);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t("games.library.romsDownloadTitle", { name: gameName })}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t("games.library.romsDownloadDescription")}
        </Typography>
        <Stack spacing={1}>
          {roms.map((rom) => (
            <Paper key={rom.id} variant="outlined" sx={{ p: 1.5 }}>
              <Stack
                direction="row"
                spacing={1}
                sx={{ alignItems: "center", justifyContent: "space-between" }}
              >
                <Typography variant="body2" sx={{ minWidth: 0, overflowWrap: "anywhere" }}>
                  {rom.label ? `${rom.label} (${rom.originalFilename})` : rom.originalFilename} ·{" "}
                  {formatFileSize(rom.sizeBytes)}
                </Typography>
                <Button
                  size="small"
                  startIcon={<DownloadIcon />}
                  disabled={downloadingRomId === rom.id}
                  onClick={() => void handleDownload(rom)}
                  sx={{ flexShrink: 0 }}
                >
                  {t("games.gogInstallers.downloadButton")}
                </Button>
              </Stack>
            </Paper>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.close")}</Button>
      </DialogActions>
    </Dialog>
  );
};

export default RomsDownloadDialog;
