import { useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Close from "@mui/icons-material/Close";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import type { GogInstallerFile } from "../api/integrations";
import {
  useDeleteGogInstaller,
  useGogInstallerFileLink,
  useGogInstallers,
  useQueueGogInstallerDownload,
  useUploadGogInstaller,
} from "../hooks/useIntegrations";
import { formatFileSize } from "../utils/roms";
import { TOAST_OPTIONS } from "../utils/toastOptions";

interface GogInstallersSectionProps {
  gameId: number;
  // Only GOG-imported games have installers from the CDN, and only copies that
  // take uploads (DRM-Free digital, Abandonware, Other) take uploaded files —
  // the dialog only mounts this section (and fires the query) when a library
  // item qualifies, so every other dialog skips the request entirely.
  hasGogItem: boolean;
  hasUploadableItem: boolean;
}

// Offline installers for a GOG-imported game: the NAS downloads each file in the
// background (uploads/gog-installers, never part of backups), and once a file is on
// the NAS the button serves it to this device instead. Copies that take uploads
// get the same treatment from their own folder (uploads/uploaded-installers),
// except the file comes from the user: they upload it here and Download sends it
// back. The section stays hidden whenever there is nothing to show (a GOG game with
// no installers and no uploads, and no copy to upload for).
const GogInstallersSection = ({ gameId, hasGogItem, hasUploadableItem }: GogInstallersSectionProps) => {
  const { t } = useTranslation();
  const { data: installers, isError } = useGogInstallers(gameId, hasGogItem || hasUploadableItem);
  const queueDownload = useQueueGogInstallerDownload(gameId);
  const fileLink = useGogInstallerFileLink();
  const uploadInstaller = useUploadGogInstaller(gameId);
  const deleteInstaller = useDeleteGogInstaller(gameId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // The file waiting in the delete warning — null while no delete is in flight.
  const [pendingDelete, setPendingDelete] = useState<{
    fileId: string;
    filename: string;
    uploaded: boolean;
  } | null>(null);

  if (!hasGogItem && !hasUploadableItem) return null;
  if (isError || !installers) return null;
  if (installers.groups.length === 0 && installers.uploadedFiles.length === 0 && !hasUploadableItem) {
    return null;
  }

  const handleQueue = async (installerId: string, fileId: string) => {
    try {
      await queueDownload.mutateAsync({ installerId, fileId });
    } catch (error) {
      console.error(`Error queueing GOG installer file ${fileId}:`, error);
      toast.error(t("games.gogInstallers.queueErrorToast"), TOAST_OPTIONS);
    }
  };

  const handleDownload = async (fileId: string) => {
    try {
      const url = await fileLink.mutateAsync({ gameId, fileId });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      console.error(`Error fetching GOG installer download link for ${fileId}:`, error);
      toast.error(t("games.gogInstallers.linkErrorToast"), TOAST_OPTIONS);
    }
  };

  const handleUpload = async (file: File | undefined) => {
    if (!file) return;
    try {
      await uploadInstaller.mutateAsync(file);
    } catch (error) {
      console.error("Error uploading installer:", error);
      toast.error(t("games.gogInstallers.uploadErrorToast"), TOAST_OPTIONS);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!pendingDelete) return;
    try {
      await deleteInstaller.mutateAsync(pendingDelete.fileId);
      setPendingDelete(null);
    } catch (error) {
      console.error(`Error deleting installer file ${pendingDelete.fileId}:`, error);
      toast.error(t("games.gogInstallers.deleteErrorToast"), TOAST_OPTIONS);
    }
  };

  const renderFileAction = (installerId: string, file: GogInstallerFile, displayName: string) => {
    switch (file.downloadState) {
      case "queued":
      case "downloading":
        return (
          <Box sx={{ minWidth: 160 }}>
            <LinearProgress
              variant="determinate"
              value={file.size > 0 ? Math.min(100, (file.downloadedBytes / file.size) * 100) : 0}
            />
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
              {t("games.gogInstallers.downloadingLabel", {
                downloaded: formatFileSize(file.downloadedBytes),
                total: formatFileSize(file.size),
              })}
            </Typography>
          </Box>
        );
      case "completed":
        return (
          <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
            <Button
              variant="outlined"
              size="small"
              onClick={() => void handleDownload(file.id)}
              disabled={fileLink.isPending}
            >
              {t("games.gogInstallers.downloadButton")}
            </Button>
            <IconButton
              size="small"
              aria-label={t("games.gogInstallers.deleteInstallerLabel", { name: displayName })}
              onClick={() => setPendingDelete({ fileId: file.id, filename: displayName, uploaded: false })}
              disabled={deleteInstaller.isPending}
            >
              <Close fontSize="small" />
            </IconButton>
          </Stack>
        );
      case "failed":
        return (
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            {file.downloadError && (
              <Typography variant="caption" color="error">
                {file.downloadError}
              </Typography>
            )}
            <Button
              variant="outlined"
              size="small"
              onClick={() => void handleQueue(installerId, file.id)}
              disabled={queueDownload.isPending}
            >
              {t("games.gogInstallers.retryButton")}
            </Button>
          </Stack>
        );
      case "not_downloaded":
      default:
        return (
          <Button
            variant="outlined"
            size="small"
            onClick={() => void handleQueue(installerId, file.id)}
            disabled={queueDownload.isPending}
          >
            {t("games.gogInstallers.cacheDownloadButton")}
          </Button>
        );
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", mb: 2 }}>
        <Typography variant="h6" component="h2">
          {t(hasGogItem ? "games.gogInstallers.heading" : "games.gogInstallers.installersHeading")}
        </Typography>
        {hasUploadableItem ? (
          <>
            <input
              ref={fileInputRef}
              type="file"
              hidden
              onChange={(event) => {
                void handleUpload(event.target.files?.[0]);
                // Reset so the same file can be picked again (re-upload replaces it).
                event.target.value = "";
              }}
            />
            <Button
              variant="outlined"
              size="small"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadInstaller.isPending}
            >
              {t("games.gogInstallers.uploadButton")}
            </Button>
          </>
        ) : null}
      </Stack>
      {installers.uploadedFiles.length > 0 ? (
        <Box sx={{ mb: 2 }}>
          {installers.uploadedFiles.map((uploaded) => (
            <Stack
              key={uploaded.fileId}
              direction="row"
              spacing={1}
              sx={{ alignItems: "center", justifyContent: "space-between", pl: 1, py: 0.5 }}
            >
              <Typography variant="body2" color="text.secondary">
                {t("games.gogInstallers.uploadedFileLabel", {
                  name: uploaded.filename ?? uploaded.fileId,
                  size: formatFileSize(uploaded.size),
                })}
              </Typography>
              <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => void handleDownload(uploaded.fileId)}
                  disabled={fileLink.isPending}
                >
                  {t("games.gogInstallers.downloadButton")}
                </Button>
                <IconButton
                  size="small"
                  aria-label={t("games.gogInstallers.deleteInstallerLabel", {
                    name: uploaded.filename ?? uploaded.fileId,
                  })}
                  onClick={() =>
                    setPendingDelete({
                      fileId: uploaded.fileId,
                      filename: uploaded.filename ?? uploaded.fileId,
                      uploaded: true,
                    })
                  }
                  disabled={deleteInstaller.isPending}
                >
                  <Close fontSize="small" />
                </IconButton>
              </Stack>
            </Stack>
          ))}
        </Box>
      ) : null}
      {installers.groups.map((group) => (
        <Box key={group.productId} sx={{ mb: 2 }}>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>
            {group.title}
          </Typography>
          {group.installers.map((installer) => (
            <Box key={installer.id} sx={{ mb: 1.5, pl: 1 }}>
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                {t("games.gogInstallers.installerLabel", {
                  os: installer.os,
                  language: installer.language,
                  version: installer.version ?? "",
                  size: formatFileSize(installer.totalSize),
                })}
              </Typography>
              {installer.files.map((file) => (
                <Stack
                  key={file.id}
                  direction="row"
                  spacing={1}
                  sx={{ alignItems: "center", justifyContent: "space-between", pl: 1, py: 0.5 }}
                >
                  <Typography variant="body2" color="text.secondary">
                    {t("games.gogInstallers.fileLabel", { size: formatFileSize(file.size) })}
                  </Typography>
                  {renderFileAction(
                    installer.id,
                    file,
                    t("games.gogInstallers.installerLabel", {
                      os: installer.os,
                      language: installer.language,
                      version: installer.version ?? "",
                      size: formatFileSize(installer.totalSize),
                    })
                  )}
                </Stack>
              ))}
            </Box>
          ))}
        </Box>
      ))}
      <Dialog open={pendingDelete != null} onClose={() => setPendingDelete(null)}>
        <DialogTitle>{t("games.gogInstallers.deleteDialogTitle")}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {pendingDelete?.uploaded
              ? t("games.gogInstallers.deleteDialogUploadedDescription", {
                  name: pendingDelete.filename,
                })
              : t("games.gogInstallers.deleteDialogGogDescription", {
                  name: pendingDelete?.filename ?? "",
                })}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingDelete(null)}>{t("common.cancel")}</Button>
          <Button color="error" onClick={() => void handleDeleteConfirm()} disabled={deleteInstaller.isPending}>
            {t("games.gogInstallers.deleteDialogConfirm")}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default GogInstallersSection;
