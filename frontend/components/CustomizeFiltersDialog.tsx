import { useState, type DragEvent } from "react";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import {
  DEFAULT_FILTER_LAYOUT,
  type FilterField,
  type FilterFieldKey,
} from "../hooks/useFilterLayout";

interface CustomizeFiltersDialogProps {
  // Only the fields applicable on the page the dialog was opened from — fields that
  // page never renders (e.g. Game Type on Missing Addons) aren't listed, and the
  // caller merges them back on save so other pages keep their places.
  fields: FilterField[];
  labels: Record<FilterFieldKey, string>;
  saving: boolean;
  onClose: () => void;
  onSave: (fields: FilterField[]) => void;
}

// Show/hide and reorder the Games filter dialog's fields: drag a row by its handle,
// or use the arrows (keyboard and touch). Nothing changes until Save. Mounted only
// while open, so each opening starts from the saved layout. Mirrors
// CustomizeOverviewDialog's rows (same drag/arrow/switch pattern, no card-size slider).
const CustomizeFiltersDialog = ({
  fields,
  labels,
  saving,
  onClose,
  onSave,
}: CustomizeFiltersDialogProps) => {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(fields);
  const [dragKey, setDragKey] = useState<FilterFieldKey | null>(null);

  const moveTo = (key: FilterFieldKey, index: number) =>
    setDraft((current) => {
      const from = current.findIndex((field) => field.key === key);
      if (from < 0 || index < 0 || index >= current.length || from === index) return current;
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(index, 0, moved);
      return next;
    });

  const handleDragOver = (event: DragEvent, overKey: FilterFieldKey) => {
    if (!dragKey) return;
    event.preventDefault();
    if (dragKey !== overKey)
      moveTo(
        dragKey,
        draft.findIndex((field) => field.key === overKey)
      );
  };

  const toggle = (key: FilterFieldKey) =>
    setDraft((current) =>
      current.map((field) =>
        field.key === key ? { ...field, hidden: !field.hidden } : field
      )
    );

  return (
    <Dialog open onClose={saving ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle>{t("games.listToolbar.customize.title")}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          {t("games.listToolbar.customize.description")}
        </Typography>
        <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0, display: "grid", gap: 0.75 }}>
          {draft.map((field, index) => {
            const label = labels[field.key];
            return (
              <Box
                component="li"
                key={field.key}
                draggable
                onDragStart={(event: DragEvent) => {
                  event.dataTransfer.effectAllowed = "move";
                  // Firefox only starts a drag when some data is set.
                  event.dataTransfer.setData("text/plain", field.key);
                  setDragKey(field.key);
                }}
                onDragOver={(event: DragEvent) => handleDragOver(event, field.key)}
                onDrop={(event: DragEvent) => event.preventDefault()}
                onDragEnd={() => setDragKey(null)}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.5,
                  pl: 0.5,
                  pr: 0.25,
                  py: 0.25,
                  border: 1,
                  borderColor: dragKey === field.key ? "primary.main" : "divider",
                  borderRadius: 2,
                  bgcolor: "background.paper",
                  opacity: dragKey === field.key ? 0.6 : 1,
                  // The list above is display: grid, and grid items default to
                  // min-width: auto — the row's min-content width, which counts the
                  // nowrap label at full length. On phone widths that exceeds the
                  // dialog and clips the toggle off the right edge. minWidth: 0 lets
                  // the row shrink so the label ellipsizes instead.
                  minWidth: 0,
                }}
              >
                <DragIndicatorIcon
                  fontSize="small"
                  sx={{ color: "text.secondary", cursor: "grab" }}
                  aria-hidden
                />
                <Box
                  sx={{
                    flex: 1,
                    minWidth: 0,
                    fontSize: 14,
                    color: field.hidden ? "text.secondary" : "text.primary",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {label}
                </Box>
                <IconButton
                  size="small"
                  onClick={() => moveTo(field.key, index - 1)}
                  disabled={index === 0}
                  aria-label={t("games.listToolbar.customize.moveUp", { name: label })}
                >
                  <ArrowUpwardIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={() => moveTo(field.key, index + 1)}
                  disabled={index === draft.length - 1}
                  aria-label={t("games.listToolbar.customize.moveDown", { name: label })}
                >
                  <ArrowDownwardIcon fontSize="small" />
                </IconButton>
                <Switch
                  size="small"
                  checked={!field.hidden}
                  onChange={() => toggle(field.key)}
                  slotProps={{
                    input: { "aria-label": t("games.listToolbar.customize.show", { name: label }) },
                  }}
                />
              </Box>
            );
          })}
        </Box>
      </DialogContent>
      <DialogActions sx={{ justifyContent: "space-between" }}>
        <Button
          onClick={() => {
            // Reset only the fields listed here to their default order; fields this
            // page doesn't render keep their saved places (merged back on save).
            setDraft(
              DEFAULT_FILTER_LAYOUT.filter((field) =>
                fields.some((listed) => listed.key === field.key)
              )
            );
          }}
          disabled={saving}
        >
          {t("games.listToolbar.customize.reset")}
        </Button>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button onClick={onClose} disabled={saving}>
            {t("common.cancel")}
          </Button>
          <Button variant="contained" onClick={() => onSave(draft)} disabled={saving}>
            {t("common.save")}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
};

export default CustomizeFiltersDialog;
