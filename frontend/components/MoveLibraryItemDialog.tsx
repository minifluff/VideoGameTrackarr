import { useState } from "react";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { useMoveLibraryItem, useSplitLibraryItem } from "../hooks/useLibrary";
import { useGames } from "../hooks/useGames";
import { TOAST_OPTIONS } from "../utils/toastOptions";

interface MoveLibraryItemDialogProps {
  open: boolean;
  onClose: () => void;
  itemId: number;
  itemLabel: string;
  currentGameId: number;
}

const MoveLibraryItemDialog = ({
  open,
  onClose,
  itemId,
  itemLabel,
  currentGameId,
}: MoveLibraryItemDialogProps) => {
  const { t } = useTranslation();
  const [tab, setTab] = useState<"move" | "split">("move");
  const [search, setSearch] = useState("");
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null);
  const [newGameName, setNewGameName] = useState("");

  const moveMutation = useMoveLibraryItem();
  const splitMutation = useSplitLibraryItem();
  const { data: searchResults } = useGames(
    { search: search.length >= 2 ? search : undefined },
    { enabled: open && tab === "move" }
  );

  const handleMove = () => {
    if (!selectedGameId) return;
    moveMutation.mutate(
      { itemId, targetGameId: selectedGameId },
      {
        onSuccess: () => {
          toast.success(t("library.moveItemSuccess"), TOAST_OPTIONS);
          onClose();
        },
        onError: () => {
          toast.error(t("library.moveItemError"), TOAST_OPTIONS);
        },
      }
    );
  };

  const handleSplit = () => {
    if (!newGameName.trim()) return;
    splitMutation.mutate(
      { itemId, newGameName: newGameName.trim() },
      {
        onSuccess: () => {
          toast.success(t("library.splitItemSuccess"), TOAST_OPTIONS);
          onClose();
        },
        onError: () => {
          toast.error(t("library.splitItemError"), TOAST_OPTIONS);
        },
      }
    );
  };

  const isPending = moveMutation.isPending || splitMutation.isPending;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t("library.moveItemTitle")}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t("library.moveItemDescription", { item: itemLabel })}
        </Typography>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
          <Tab value="move" label={t("library.moveToGameTab")} />
          <Tab value="split" label={t("library.splitToNewGameTab")} />
        </Tabs>
        {tab === "move" ? (
          <Autocomplete
            options={(searchResults ?? []).filter((g) => g.id !== currentGameId)}
            getOptionLabel={(option) => option.name}
            value={(searchResults ?? []).find((g) => g.id === selectedGameId) ?? null}
            onChange={(_, value) => setSelectedGameId(value?.id ?? null)}
            inputValue={search}
            onInputChange={(_, value) => setSearch(value)}
            renderInput={(params) => (
              <TextField
                {...params}
                label={t("library.targetGameLabel")}
                placeholder={t("library.targetGamePlaceholder")}
                fullWidth
              />
            )}
          />
        ) : (
          <TextField
            fullWidth
            label={t("library.newGameNameLabel")}
            placeholder={t("library.newGameNamePlaceholder")}
            value={newGameName}
            onChange={(e) => setNewGameName(e.target.value)}
          />
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isPending}>
          {t("common.cancel")}
        </Button>
        {tab === "move" ? (
          <Button
            onClick={handleMove}
            variant="contained"
            disabled={!selectedGameId || isPending}
          >
            {t("library.moveButton")}
          </Button>
        ) : (
          <Button
            onClick={handleSplit}
            variant="contained"
            disabled={!newGameName.trim() || isPending}
          >
            {t("library.splitButton")}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default MoveLibraryItemDialog;
