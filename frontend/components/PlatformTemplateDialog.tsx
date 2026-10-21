import { useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import DeleteIcon from "@mui/icons-material/Delete";
import UploadIcon from "@mui/icons-material/Upload";
import { useTranslation } from "react-i18next";
import { resolveAssetUrl } from "../api/client";
import type { PlatformResponse } from "../api/types";
import { useSetPlatformSpineTemplate } from "../hooks/usePlatforms";
import { useUploadSpine } from "../hooks/useUploads";

interface PlatformTemplateDialogProps {
  platform: PlatformResponse | null;
  onClose: () => void;
}

// Opened from a Bookshelf platform divider: the uploaded image becomes the
// blank spine template behind EVERY case of that platform on the shelf.
const PlatformTemplateDialog = ({ platform, onClose }: PlatformTemplateDialogProps) => {
  const { t } = useTranslation();
  const uploadSpine = useUploadSpine();
  const setTemplate = useSetPlatformSpineTemplate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState(false);

  const busy = uploadSpine.isPending || setTemplate.isPending;
  const templateUrl = platform?.spineTemplateUrl ?? null;

  const handleFilePicked = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !platform) return;
    setError(false);
    try {
      const { url } = await uploadSpine.mutateAsync(file);
      await setTemplate.mutateAsync({ platformId: platform.id, spineUrl: url });
      onClose();
    } catch {
      setError(true);
    }
  };

  const handleRemove = async () => {
    if (!platform) return;
    setError(false);
    try {
      await setTemplate.mutateAsync({ platformId: platform.id, spineUrl: null });
      onClose();
    } catch {
      setError(true);
    }
  };

  return (
    <Dialog open={platform !== null} onClose={busy ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>
        {t("games.bookshelf.template.title", { platform: platform?.name ?? "" })}
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t("games.bookshelf.template.hint")}
        </Typography>
        {templateUrl ? (
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              mb: 2,
              p: 1,
              borderRadius: 1,
              backgroundColor: "action.hover",
            }}
          >
            <Box
              component="img"
              src={resolveAssetUrl(templateUrl) ?? undefined}
              alt={platform?.name ?? ""}
              sx={{ height: 190, maxWidth: "100%", objectFit: "contain", display: "block" }}
            />
          </Box>
        ) : (
          <Typography variant="body2" sx={{ mb: 2 }}>
            {t("games.bookshelf.template.empty")}
          </Typography>
        )}
        {error && (
          <Typography variant="body2" color="error" sx={{ mb: 1 }}>
            {t("games.bookshelf.template.saveError")}
          </Typography>
        )}
        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            startIcon={busy ? <CircularProgress size={16} /> : <UploadIcon />}
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
          >
            {templateUrl ? t("games.bookshelf.template.replace") : t("games.bookshelf.template.upload")}
          </Button>
          {templateUrl && (
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={handleRemove}
              disabled={busy}
            >
              {t("games.bookshelf.template.remove")}
            </Button>
          )}
        </Stack>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleFilePicked}
          aria-label={t("games.bookshelf.template.upload")}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          {t("common.close")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PlatformTemplateDialog;
