import { isAxiosError } from "axios";
import CloudDownloadIcon from "@mui/icons-material/CloudDownload";
import Close from "@mui/icons-material/Close";
import ReplayIcon from "@mui/icons-material/Replay";
import SaveAltIcon from "@mui/icons-material/SaveAlt";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import LinearProgress from "@mui/material/LinearProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import type { GogInstaller, GogInstallerFile, GogInstallerGroup } from "../api/integrations";
import {
  useDownloadGogInstaller,
  useGogInstallerFileLink,
  useGogInstallers,
} from "../hooks/useIntegrations";
import { formatFileSize } from "../utils/roms";
import { TOAST_OPTIONS } from "../utils/toastOptions";

const OS_LABEL_KEYS: Record<string, string> = {
  windows: "games.gogInstallers.os.windows",
  mac: "games.gogInstallers.os.mac",
  osx: "games.gogInstallers.os.mac",
  linux: "games.gogInstallers.os.linux",
};

// Overall state of one installer from its parts: the .exe and its .bin files belong together.
function installerState(installer: GogInstaller) {
  const parts = installer.files;
  const total = parts.reduce((sum, part) => sum + part.size, 0);
  const done = parts.reduce(
    (sum, part) =>
      sum +
      (part.downloadState === "completed"
        ? part.size
        : part.downloadState === "downloading"
          ? part.downloadedBytes
          : 0),
    0
  );
  return {
    allDone: parts.every((part) => part.downloadState === "completed"),
    active: parts.some((part) => part.downloadState === "queued" || part.downloadState === "downloading"),
    failed: parts.some((part) => part.downloadState === "failed"),
    canStart: parts.some((part) => part.downloadState === "not_downloaded" || part.downloadState === "failed"),
    progress: total > 0 ? Math.min(100, (done / total) * 100) : 0,
  };
}

interface GogInstallersListProps {
  gameId: number;
  // Fetches (and polls) only while shown.
  enabled: boolean;
  // Set in the edit dialog so a finished part can be deleted from the NAS
  // again — the standalone dialog never offers it.
  onDeleteFile?: (file: GogInstallerFile, displayName: string) => void;
}

// The installers for one game and its DLC, each with Download to server, progress, and Save
// to device per finished part. Shown in the Offline installers dialog, opened from a GOG
// copy's download icon on the game page, and in the copy's own edit dialog.
export const GogInstallersList = ({ gameId, enabled, onDeleteFile }: GogInstallersListProps) => {
  const { t } = useTranslation();
  const { data, isLoading, error } = useGogInstallers(gameId, enabled);
  const download = useDownloadGogInstaller(gameId);
  const fileLink = useGogInstallerFileLink();

  const handleDownload = async (productId: number, installerId: string) => {
    try {
      await download.mutateAsync({ productId, installerId });
    } catch (err) {
      console.error(`Error queueing GOG installer ${installerId}:`, err);
      toast.error(t("games.gogInstallers.queueErrorToast"), TOAST_OPTIONS);
    }
  };

  const handleSave = async (part: GogInstallerFile) => {
    try {
      const url = await fileLink.mutateAsync({ gameId, fileId: part.id });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      console.error(`Error fetching GOG installer download link for ${part.id}:`, err);
      toast.error(t("games.gogInstallers.saveErrorToast"), TOAST_OPTIONS);
    }
  };

  const errorMessage = (() => {
    if (!error) return null;
    if (isAxiosError(error) && error.response?.status === 404)
      return t("games.gogInstallers.notAvailable");
    if (isAxiosError(error) && error.response?.status === 409)
      return t("games.gogInstallers.notConnected");
    if (isAxiosError(error) && error.response?.status === 422)
      return t("games.gogInstallers.signInAgain");
    return t("games.gogInstallers.loadError");
  })();

  const renderPart = (part: GogInstallerFile, index: number, count: number, displayName: string) => (
    <Stack
      key={part.id}
      direction="row"
      spacing={1}
      sx={{ alignItems: "center", justifyContent: "space-between", py: 0.25 }}
    >
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ minWidth: 0, overflowWrap: "anywhere" }}
      >
        {part.filename ?? t("games.gogInstallers.partLabel", { index: index + 1, count })} ·{" "}
        {formatFileSize(part.size)}
        {part.downloadState === "failed" && part.downloadError ? ` · ${part.downloadError}` : ""}
      </Typography>
      {part.downloadState === "completed" ? (
        <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", flexShrink: 0 }}>
          <Button
            size="small"
            startIcon={<SaveAltIcon />}
            onClick={() => void handleSave(part)}
          >
            {t("games.gogInstallers.saveButton")}
          </Button>
          {onDeleteFile ? (
            <IconButton
              size="small"
              aria-label={t("games.gogInstallers.deleteInstallerLabel", { name: displayName })}
              onClick={() => onDeleteFile(part, displayName)}
            >
              <Close fontSize="small" />
            </IconButton>
          ) : null}
        </Stack>
      ) : (
        <Typography
          variant="caption"
          color={part.downloadState === "failed" ? "error" : "text.secondary"}
          sx={{ flexShrink: 0 }}
        >
          {t(`games.gogInstallers.state.${part.downloadState}`)}
        </Typography>
      )}
    </Stack>
  );

  const renderInstaller = (productId: number, installer: GogInstaller) => {
    const state = installerState(installer);
    const installerLabel = t("games.gogInstallers.installerLabel", {
      os: installer.os,
      language: installer.language,
      version: installer.version ?? "",
      size: formatFileSize(installer.totalSize),
    });
    return (
      <Paper
        key={`${productId}:${installer.id}`}
        variant="outlined"
        sx={{ p: 1.5, borderRadius: 2 }}
      >
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          sx={{ alignItems: { sm: "center" }, justifyContent: "space-between" }}
        >
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 0.5 }}
          >
            <Chip
              size="small"
              label={OS_LABEL_KEYS[installer.os] ? t(OS_LABEL_KEYS[installer.os]) : installer.os}
            />
            {installer.language && (
              <Chip size="small" variant="outlined" label={installer.language.toUpperCase()} />
            )}
            <Typography variant="body2" color="text.secondary">
              {[
                installer.version,
                formatFileSize(installer.totalSize),
                t("games.gogInstallers.partCount", { count: installer.files.length }),
              ]
                .filter(Boolean)
                .join(" · ")}
            </Typography>
          </Stack>
          {state.canStart && (
            <Button
              size="small"
              variant={state.failed ? "outlined" : "contained"}
              startIcon={state.failed ? <ReplayIcon /> : <CloudDownloadIcon />}
              onClick={() => void handleDownload(productId, installer.id)}
              disabled={download.isPending}
              sx={{ flexShrink: 0 }}
            >
              {state.failed
                ? t("games.gogInstallers.retryButton")
                : t("games.gogInstallers.downloadToServerButton")}
            </Button>
          )}
        </Stack>
        {state.active && (
          <Box sx={{ mt: 1 }}>
            <LinearProgress
              variant="determinate"
              value={state.progress}
              aria-label={t("games.gogInstallers.progressLabel")}
            />
          </Box>
        )}
        {(state.active ||
          state.allDone ||
          state.failed ||
          installer.files.some((part) => part.downloadState === "completed")) && (
          <Box sx={{ mt: 1 }}>
            {installer.files.map((part, index) => renderPart(part, index, installer.files.length, installerLabel))}
          </Box>
        )}
      </Paper>
    );
  };

  return isLoading ? (
    <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
      <CircularProgress size={28} />
    </Box>
  ) : errorMessage ? (
    <Alert severity="info">{errorMessage}</Alert>
  ) : !data || data.groups.length === 0 ? (
    <Alert severity="info">{t("games.gogInstallers.empty")}</Alert>
  ) : (
    <Stack spacing={2.5}>
      {data.groups.map((group: GogInstallerGroup) => (
        <Box key={group.productId}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            {group.title}
          </Typography>
          <Stack spacing={1}>{group.installers.map((installer) => renderInstaller(group.productId, installer))}</Stack>
        </Box>
      ))}
    </Stack>
  );
};

interface GogInstallersDialogProps {
  gameId: number;
  gameName: string;
  open: boolean;
  onClose: () => void;
}

const GogInstallersDialog = ({ gameId, gameName, open, onClose }: GogInstallersDialogProps) => {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t("games.gogInstallers.title", { name: gameName })}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t("games.gogInstallers.description")}
        </Typography>
        <GogInstallersList gameId={gameId} enabled={open} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.close")}</Button>
      </DialogActions>
    </Dialog>
  );
};

export default GogInstallersDialog;
