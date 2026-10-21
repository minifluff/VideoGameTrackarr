import { useRef } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import DeleteIcon from "@mui/icons-material/Delete";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { resolveAssetUrl } from "../api/client";
import { useSetGameSpine } from "../hooks/useGames";
import { useUploadSpine } from "../hooks/useUploads";
import { TOAST_OPTIONS } from "../utils/toastOptions";

interface SpineArtCardProps {
  gameId: number;
  spineUrl: string | null;
}

// Bookshelf mode's per-game spine art control, shown under the cover on the
// game details page. Works for every game (unlike the manual edit form, which
// refuses IGDB-linked games): upload stores the image via /api/uploads/spines
// and the returned URL is saved through the dedicated spine endpoint.
const SpineArtCard = ({ gameId, spineUrl }: SpineArtCardProps) => {
  const { t } = useTranslation();
  const uploadSpine = useUploadSpine();
  const setGameSpine = useSetGameSpine();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isPending = uploadSpine.isPending || setGameSpine.isPending;

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const { url } = await uploadSpine.mutateAsync(file);
      await setGameSpine.mutateAsync({ gameId, spineUrl: url });
      toast.success(t("games.spineArt.saved"), TOAST_OPTIONS);
    } catch {
      toast.error(t("games.spineArt.uploadError"), TOAST_OPTIONS);
    }
  };

  const handleRemove = async () => {
    try {
      await setGameSpine.mutateAsync({ gameId, spineUrl: null });
      toast.success(t("games.spineArt.saved"), TOAST_OPTIONS);
    } catch {
      toast.error(t("games.spineArt.uploadError"), TOAST_OPTIONS);
    }
  };

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
        {t("games.spineArt.heading")}
      </Typography>
      {spineUrl ? (
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            mb: 1.5,
            // Checkerboard so pale/white spines stay visible against the card.
            backgroundImage:
              "repeating-conic-gradient(rgba(127,127,127,0.18) 0% 25%, transparent 0% 50%)",
            backgroundSize: "16px 16px",
            borderRadius: 1,
            py: 1,
          }}
        >
          <Box
            component="img"
            src={resolveAssetUrl(spineUrl) ?? undefined}
            alt={t("games.spineArt.heading")}
            sx={{ height: 140, maxWidth: "100%", objectFit: "contain" }}
          />
        </Box>
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          {t("games.spineArt.empty")}
        </Typography>
      )}
      <Stack direction="row" spacing={1}>
        <Button
          variant="outlined"
          size="small"
          startIcon={isPending ? <CircularProgress size={16} /> : <CloudUploadIcon />}
          onClick={() => fileInputRef.current?.click()}
          disabled={isPending}
        >
          {spineUrl ? t("games.spineArt.replace") : t("games.spineArt.upload")}
        </Button>
        {spineUrl && (
          <Button
            variant="outlined"
            size="small"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={handleRemove}
            disabled={isPending}
          >
            {t("games.spineArt.remove")}
          </Button>
        )}
      </Stack>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFile}
        aria-label={t("games.spineArt.upload")}
      />
    </Paper>
  );
};

export default SpineArtCard;
