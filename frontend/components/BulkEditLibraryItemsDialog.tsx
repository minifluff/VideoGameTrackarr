import { useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import TextField from "@mui/material/TextField";
import { useTranslation } from "react-i18next";
import type { BulkLibraryField } from "../api/library";
import type { MediaFormat } from "../api/types";
import { useBulkUpdateLibraryItems } from "../hooks/useLibrary";
import { usePlatforms } from "../hooks/usePlatforms";
import { useRegions } from "../hooks/useRegions";

const FORMAT_OPTIONS: { value: MediaFormat; labelKey: string }[] = [
  { value: "physical", labelKey: "dialogs.libraryItem.formatPhysical" },
  { value: "digital", labelKey: "dialogs.libraryItem.formatDigital" },
  { value: "iso", labelKey: "dialogs.libraryItem.formatIso" },
  { value: "rom", labelKey: "dialogs.libraryItem.formatRom" },
  { value: "abandonware", labelKey: "dialogs.libraryItem.formatAbandonware" },
  { value: "subscription", labelKey: "dialogs.libraryItem.formatSubscription" },
  { value: "other", labelKey: "dialogs.libraryItem.formatOther" },
];

const FIELD_KEYS: { value: BulkLibraryField; labelKey: string }[] = [
  { value: "format", labelKey: "games.listPage.bulkEdit.fields.format" },
  { value: "platform", labelKey: "games.listPage.bulkEdit.fields.platform" },
  { value: "region", labelKey: "games.listPage.bulkEdit.fields.region" },
  { value: "status", labelKey: "games.listPage.bulkEdit.fields.status" },
  { value: "edition", labelKey: "games.listPage.bulkEdit.fields.edition" },
  { value: "notes", labelKey: "games.listPage.bulkEdit.fields.notes" },
];

interface BulkEditLibraryItemsDialogProps {
  open: boolean;
  itemIds: number[];
  onClose: () => void;
  onApplied: (updated: number) => void;
}

// Sets ONE field to the same value on every selected library item — the List
// page's answer to "fix the format on 40 games I just imported".
const BulkEditLibraryItemsDialog = ({
  open,
  itemIds,
  onClose,
  onApplied,
}: BulkEditLibraryItemsDialogProps) => {
  const { t } = useTranslation();
  const [field, setField] = useState<BulkLibraryField>("format");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const bulkUpdate = useBulkUpdateLibraryItems();
  const { data: platforms } = usePlatforms();
  const { data: regions } = useRegions();

  useEffect(() => {
    if (open) {
      setField("format");
      setValue("");
      setError(null);
    }
  }, [open ]);

  const isTextField = field === "edition" || field === "notes";
  const canApply = isTextField || value !== "";

  const handleApply = async () => {
    const coerced: string | number | null =
      field === "platform" || field === "region" ? Number(value) : value;
    try {
      const result = await bulkUpdate.mutateAsync({ itemIds, field, value: coerced });
      onApplied(result.updated);
    } catch {
      setError(t("games.listPage.bulkEdit.error"));
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{t("games.listPage.bulkEdit.title", { count: itemIds.length })}</DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
        {error && <Alert severity="error">{error}</Alert>}
        <FormControl fullWidth sx={{ mt: 1 }}>
          <InputLabel id="bulk-edit-field-label">{t("games.listPage.bulkEdit.fieldLabel")}</InputLabel>
          <Select
            labelId="bulk-edit-field-label"
            label={t("games.listPage.bulkEdit.fieldLabel")}
            value={field}
            onChange={(event) => {
              setField(event.target.value as BulkLibraryField);
              setValue("");
              setError(null);
            }}
          >
            {FIELD_KEYS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {t(option.labelKey)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {field === "format" && (
          <FormControl fullWidth>
            <InputLabel id="bulk-edit-value-label">{t("games.listPage.bulkEdit.valueLabel")}</InputLabel>
            <Select
              labelId="bulk-edit-value-label"
              label={t("games.listPage.bulkEdit.valueLabel")}
              value={value}
              onChange={(event) => setValue(event.target.value)}
            >
              {FORMAT_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {t(option.labelKey)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        {field === "platform" && (
          <FormControl fullWidth>
            <InputLabel id="bulk-edit-value-label">{t("games.listPage.bulkEdit.valueLabel")}</InputLabel>
            <Select
              labelId="bulk-edit-value-label"
              label={t("games.listPage.bulkEdit.valueLabel")}
              value={value}
              onChange={(event) => setValue(event.target.value)}
            >
              {(platforms ?? []).map((platform) => (
                <MenuItem key={platform.id} value={String(platform.id)}>
                  {platform.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        {field === "region" && (
          <FormControl fullWidth>
            <InputLabel id="bulk-edit-value-label">{t("games.listPage.bulkEdit.valueLabel")}</InputLabel>
            <Select
              labelId="bulk-edit-value-label"
              label={t("games.listPage.bulkEdit.valueLabel")}
              value={value}
              onChange={(event) => setValue(event.target.value)}
            >
              {(regions ?? []).map((region) => (
                <MenuItem key={region.id} value={String(region.id)}>
                  {region.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        {field === "status" && (
          <FormControl fullWidth>
            <InputLabel id="bulk-edit-value-label">{t("games.listPage.bulkEdit.valueLabel")}</InputLabel>
            <Select
              labelId="bulk-edit-value-label"
              label={t("games.listPage.bulkEdit.valueLabel")}
              value={value}
              onChange={(event) => setValue(event.target.value)}
            >
              <MenuItem value="owned">{t("games.listPage.bulkEdit.statusOwned")}</MenuItem>
              <MenuItem value="wishlist">{t("games.listPage.bulkEdit.statusWishlist")}</MenuItem>
            </Select>
          </FormControl>
        )}

        {isTextField && (
          <TextField
            label={t("games.listPage.bulkEdit.valueLabel")}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            helperText={t("games.listPage.bulkEdit.blankClears")}
            fullWidth
          />
        )}

        {field === "format" && (
          <Alert severity="info">{t("games.listPage.bulkEdit.romWarning")}</Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button
          variant="contained"
          onClick={handleApply}
          disabled={!canApply || bulkUpdate.isPending}
        >
          {t("games.listPage.bulkEdit.apply")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default BulkEditLibraryItemsDialog;
