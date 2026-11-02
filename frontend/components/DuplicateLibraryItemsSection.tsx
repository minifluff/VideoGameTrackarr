import { useQueryClient } from "@tanstack/react-query";
import BlockIcon from "@mui/icons-material/Block";
import DeleteIcon from "@mui/icons-material/Delete";
import UndoIcon from "@mui/icons-material/Undo";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { deleteLibraryItem } from "../api/library";
import type { DuplicateLibraryItemGroup, IgnoredDuplicateGroup, LibraryItem } from "../api/types";
import {
  useDuplicateLibraryItems,
  useIgnoreDuplicateLibraryItems,
  useIgnoredDuplicateLibraryItems,
  useUnignoreDuplicateLibraryItems,
} from "../hooks/useInsights";
import { useSessionState } from "../hooks/useSessionState";
import { useUndoableAction } from "../hooks/useUndoableAction";
import { TOAST_OPTIONS } from "../utils/toastOptions";
import { gameIdentifier } from "../utils/identifiers";
import { showUndoToast } from "./UndoToast";
import VirtualList from "./VirtualList";

const DuplicateLibraryItemsSection = () => {
  const { t } = useTranslation();
  const STATUS_LABEL: Record<string, string> = {
    owned: t("insights.duplicates.statusOwned"),
    wishlist: t("insights.duplicates.statusWishlist"),
  };
  const { data: groups } = useDuplicateLibraryItems();
  const [showIgnored, setShowIgnored] = useSessionState("duplicates.showIgnored", false);
  const { data: ignoredGroups } = useIgnoredDuplicateLibraryItems(showIgnored);
  const ignoreGroup = useIgnoreDuplicateLibraryItems();
  const unignoreGroup = useUnignoreDuplicateLibraryItems();
  const queryClient = useQueryClient();

  const { schedule, isPending } = useUndoableAction<LibraryItem>({
    getId: (item) => item.id,
    onCommit: async (items) => {
      await Promise.all(items.map((item) => deleteLibraryItem(item.id)));
      queryClient.invalidateQueries({ queryKey: ["insights", "duplicate-library-items"] });
      queryClient.invalidateQueries({ queryKey: ["games"] });
    },
  });

  const handleDelete = (item: LibraryItem) => {
    const { undo } = schedule([item]);
    showUndoToast(t("insights.duplicates.removedToast"), undo, 5000);
  };

  // Every item in a group shares the grouping key by construction, so the first
  // item carries the whole key the backend needs to record the ignore.
  const handleIgnore = async (group: DuplicateLibraryItemGroup) => {
    const first = group.items[0];
    if (!first) return;
    try {
      await ignoreGroup.mutateAsync({
        gameId: group.gameId,
        status: first.status,
        platformId: first.platformId,
        regionId: first.regionId,
        format: first.format,
        edition: first.edition,
      });
      toast.success(t("insights.duplicates.ignoredToast"), TOAST_OPTIONS);
    } catch (error) {
      console.error("Error ignoring duplicate group:", error);
      toast.error(t("insights.duplicates.ignoreErrorToast"), TOAST_OPTIONS);
    }
  };

  const handleUnignore = async (ignored: IgnoredDuplicateGroup) => {
    try {
      await unignoreGroup.mutateAsync(ignored.id);
      toast.success(t("insights.duplicates.unignoredToast"), TOAST_OPTIONS);
    } catch (error) {
      console.error("Error un-ignoring duplicate group:", error);
      toast.error(t("insights.duplicates.unignoreErrorToast"), TOAST_OPTIONS);
    }
  };

  const visibleGroups = (groups ?? [])
    .map((group) => ({ ...group, items: group.items.filter((item) => !isPending(item.id)) }))
    .filter((group) => group.items.length > 1);

  const describeIgnored = (ignored: IgnoredDuplicateGroup) =>
    [
      STATUS_LABEL[ignored.status],
      ignored.platformName ?? t("insights.duplicates.anyPlatform"),
      ignored.regionName ?? t("insights.duplicates.anyRegion"),
      ignored.edition,
    ]
      .filter(Boolean)
      .join(" · ");

  return (
    <>
      <FormControlLabel
        control={
          <Switch checked={showIgnored} onChange={(_, checked) => setShowIgnored(checked)} />
        }
        label={t("insights.duplicates.showIgnoredLabel")}
        sx={{ mb: 2 }}
      />
      {visibleGroups.length === 0 && !showIgnored ? (
        <Typography variant="body2" color="text.secondary">
          {t("insights.duplicates.noneFound")}
        </Typography>
      ) : (
        <VirtualList
          items={visibleGroups}
          getKey={(group) => group.gameId}
          estimateSize={() => 140}
          gap={16}
          renderItem={(group) => (
            <Paper variant="outlined" sx={{ p: 1.5 }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <Typography variant="subtitle2" gutterBottom sx={{ flexGrow: 1 }}>
                  <Link
                    to={`/game/${gameIdentifier({ slug: group.gameSlug, uuid: group.gameUuid, name: group.gameName })}#library`}
                  >
                    {group.gameName}
                  </Link>
                </Typography>
                <Tooltip title={t("insights.duplicates.ignoreGroupTooltip")}>
                  <IconButton
                    size="small"
                    disabled={ignoreGroup.isPending}
                    onClick={() => void handleIgnore(group)}
                  >
                    <BlockIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
              <Stack spacing={1}>
                {group.items.map((item) => (
                  <Stack key={item.id} direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                    <Typography variant="body2" sx={{ flexGrow: 1 }}>
                      {STATUS_LABEL[item.status]} · {item.platformName ?? t("insights.duplicates.anyPlatform")} ·{" "}
                      {item.regionName ?? t("insights.duplicates.anyRegion")}
                      {item.edition ? ` · ${item.edition}` : ""}
                    </Typography>
                    <Tooltip title={t("insights.duplicates.removeEntryTooltip")}>
                      <IconButton size="small" onClick={() => handleDelete(item)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                ))}
              </Stack>
            </Paper>
          )}
        />
      )}
      {showIgnored && (
        <Stack spacing={2} sx={{ mt: 3 }}>
          <Typography variant="subtitle1">{t("insights.duplicates.ignoredHeading")}</Typography>
          {(ignoredGroups ?? []).length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              {t("insights.duplicates.ignoredNone")}
            </Typography>
          ) : (
            (ignoredGroups ?? []).map((ignored) => (
              <Paper key={ignored.id} variant="outlined" sx={{ p: 1.5 }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                  <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
                    <Link
                      to={`/game/${gameIdentifier({ slug: ignored.gameSlug, uuid: ignored.gameUuid, name: ignored.gameName })}#library`}
                    >
                      {ignored.gameName}
                    </Link>
                  </Typography>
                  <Tooltip title={t("insights.duplicates.unignoreTooltip")}>
                    <IconButton
                      size="small"
                      disabled={unignoreGroup.isPending}
                      onClick={() => void handleUnignore(ignored)}
                    >
                      <UndoIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  {describeIgnored(ignored)}
                </Typography>
              </Paper>
            ))
          )}
        </Stack>
      )}
    </>
  );
};

export default DuplicateLibraryItemsSection;
