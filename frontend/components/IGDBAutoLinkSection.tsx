import { useState } from "react";
import LinkIcon from "@mui/icons-material/Link";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import LinearProgress from "@mui/material/LinearProgress";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { isAxiosError } from "axios";
import { useAutolinkGames, useUnlinkedGames } from "../hooks/useIGDBAutolink";
import { TOAST_OPTIONS } from "../utils/toastOptions";

const CHUNK_SIZE = 20;

const IGDBAutoLinkSection = () => {
  const { t } = useTranslation();
  const { data: unlinked, isLoading } = useUnlinkedGames();
  const autolink = useAutolinkGames();
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [lastResult, setLastResult] = useState<{
    linked: number;
    noMatch: number;
    failed: number;
  } | null>(null);

  const unlinkedCount = unlinked?.length ?? 0;
  const isRunning = progress !== null;

  const handleAutoLink = async () => {
    if (!unlinked || unlinked.length === 0) return;
    const ids = unlinked.map((g) => g.id);
    const total = ids.length;
    setProgress({ done: 0, total });
    setLastResult(null);

    let linkedTotal = 0;
    let noMatchTotal = 0;
    let failedTotal = 0;
    try {
      for (let i = 0; i < total; i += CHUNK_SIZE) {
        const chunk = ids.slice(i, i + CHUNK_SIZE);
        const result = await autolink.mutateAsync(chunk);
        linkedTotal += result.linked.length;
        noMatchTotal += result.noMatch.length;
        failedTotal += result.failed.length;
        setProgress({ done: Math.min(i + CHUNK_SIZE, total), total });
      }
      setLastResult({ linked: linkedTotal, noMatch: noMatchTotal, failed: failedTotal });
      toast.success(
        t("settings.igdbAutoLink.success", {
          linked: linkedTotal,
          noMatch: noMatchTotal,
          failed: failedTotal,
        }),
        TOAST_OPTIONS,
      );
    } catch (error: unknown) {
      const detail =
        isAxiosError(error) && error.response?.data?.detail
          ? String(error.response.data.detail)
          : t("settings.igdbAutoLink.error");
      toast.error(detail, TOAST_OPTIONS);
    } finally {
      setProgress(null);
    }
  };

  return (
    <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1, p: 2 }}>
      <Typography variant="subtitle2" gutterBottom>
        {t("settings.igdbAutoLink.heading")}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t("settings.igdbAutoLink.description")}
      </Typography>

      {isLoading ? (
        <Typography variant="body2" color="text.secondary">
          {t("common.loading")}
        </Typography>
      ) : (
        <Typography variant="body2" sx={{ mb: 2 }}>
          {t("settings.igdbAutoLink.unlinkedCount", { count: unlinkedCount })}
        </Typography>
      )}

      {isRunning && progress && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" gutterBottom>
            {t("settings.igdbAutoLink.progress", {
              done: progress.done,
              total: progress.total,
            })}
          </Typography>
          <LinearProgress
            variant="determinate"
            value={(progress.done / progress.total) * 100}
          />
        </Box>
      )}

      {lastResult && !isRunning && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {t("settings.igdbAutoLink.success", {
            linked: lastResult.linked,
            noMatch: lastResult.noMatch,
            failed: lastResult.failed,
          })}
        </Alert>
      )}

      <Button
        startIcon={<LinkIcon />}
        variant="contained"
        onClick={() => void handleAutoLink()}
        disabled={unlinkedCount === 0 || isRunning || isLoading}
      >
        {t("settings.igdbAutoLink.linkButton", { count: unlinkedCount })}
      </Button>
    </Box>
  );
};

export default IGDBAutoLinkSection;
