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
import type { GogUploadedInstallerFile } from "../api/integrations";
import { useGogInstallerFileLink } from "../hooks/useIntegrations";
import { formatFileSize } from "../utils/roms";
import { TOAST_OPTIONS } from "../utils/toastOptions";

interface UploadedInstallersDialogProps {
  open: boolean;
  gameId: number;
  gameName: string;
  files: GogUploadedInstallerFile[];
  onClose: () => void;
}

// Installer files uploaded to this server for one game (DRM-Free, Abandonware
// and Other copies), each with its own Download — opened from a copy's
// download icon on the game page, the same way the GOG copy's icon opens its
// offline installers. The edit dialog shows the same files with upload and
// delete; this one is download-only.
const UploadedInstallersDialog = ({
  open,
  gameId,
  gameName,
  files,
  onClose,
}: UploadedInstallersDialogProps) => {
  const { t } = useTranslation();
  const fileLink = useGogInstallerFileLink();

  const handleDownload = async (fileId: string) => {
    try {
      const url = await fileLink.mutateAsync({ gameId, fileId });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      console.error("Error fetching installer download link:", error);
      toast.error(t("games.gogInstallers.linkErrorToast"), TOAST_OPTIONS);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t("games.gogInstallers.uploadedTitle", { name: gameName })}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t("games.gogInstallers.uploadedDescription")}
        </Typography>
        {files.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {t("games.gogInstallers.uploadedEmpty")}
          </Typography>
        ) : (
          <Stack spacing={1}>
            {files.map((file) => (
              <Paper key={file.fileId} variant="outlined" sx={{ p: 1.5 }}>
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ alignItems: "center", justifyContent: "space-between" }}
                >
                  <Typography variant="body2" sx={{ minWidth: 0, overflowWrap: "anywhere" }}>
                    {file.filename ?? file.fileId} · {formatFileSize(file.size)}
                  </Typography>
                  <Button
                    size="small"
                    startIcon={<DownloadIcon />}
                    disabled={fileLink.isPending}
                    onClick={() => void handleDownload(file.fileId)}
                    sx={{ flexShrink: 0 }}
                  >
                    {t("games.gogInstallers.downloadButton")}
                  </Button>
                </Stack>
              </Paper>
            ))}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.close")}</Button>
      </DialogActions>
    </Dialog>
  );
};

export default UploadedInstallersDialog;
