import { useRef } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import type { GogInstallerFile } from "../api/integrations";
import {
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
// get the same treatment, except the file comes from the user: they upload it
// here and Download sends it back. The section stays hidden whenever there is
// nothing to show (a GOG game with no installers and no uploads, and no copy to
// upload for).
const GogInstallersSection = ({ gameId, hasGogItem, hasUploadableItem }: GogInstallersSectionProps) => {
  const { t } = useTranslation();
  const { data: installers, isError } = useGogInstallers(gameId, hasGogItem || hasUploadableItem);
  const queueDownload = useQueueGogInstallerDownload(gameId);
  const fileLink = useGogInstallerFileLink();
  const uploadInstaller = useUploadGogInstaller(gameId);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const renderFileAction = (installerId: string, file: GogInstallerFile) => {
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
          <Button
            variant="outlined"
            size="small"
            onClick={() => void handleDownload(file.id)}
            disabled={fileLink.isPending}
          >
            {t("games.gogInstallers.downloadButton")}
          </Button>
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
      <Typography variant="h6" component="h2" gutterBottom>
        {t(hasGogItem ? "games.gogInstallers.heading" : "games.gogInstallers.installersHeading")}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t(hasGogItem ? "games.gogInstallers.description" : "games.gogInstallers.uploadedDescription")}
      </Typography>
      {hasUploadableItem ? (
        <Box sx={{ mb: 2 }}>
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
        </Box>
      ) : null}
      {installers.uploadedFiles.length > 0 ? (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>
            {t("games.gogInstallers.uploadedHeading")}
          </Typography>
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
              <Button
                variant="outlined"
                size="small"
                onClick={() => void handleDownload(uploaded.fileId)}
                disabled={fileLink.isPending}
              >
                {t("games.gogInstallers.downloadButton")}
              </Button>
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
                  {renderFileAction(installer.id, file)}
                </Stack>
              ))}
            </Box>
          ))}
        </Box>
      ))}
    </Box>
  );
};

export default GogInstallersSection;
