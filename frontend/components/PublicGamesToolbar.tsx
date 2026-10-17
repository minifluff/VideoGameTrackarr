import { useState } from "react";
import ClearIcon from "@mui/icons-material/Clear";
import FilterListIcon from "@mui/icons-material/FilterList";
import SearchIcon from "@mui/icons-material/Search";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Grid from "@mui/material/Grid";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import { useTranslation } from "react-i18next";
import { useScrollDirection } from "../hooks/useScrollCollapse";
import type { GameSortOption } from "../api/types";
import { GAME_SORT_OPTIONS, type GameSortOptionItem } from "../utils/gameSortOptions";
import AutocompleteMultiSelect from "./AutocompleteMultiSelect";
import AutocompleteSelect from "./AutocompleteSelect";

interface FilterOption {
  id: number;
  name: string;
}

export type OwnershipStatus = "owned" | "wishlisted";

interface OwnershipOption {
  value: OwnershipStatus;
  labelKey: string;
}

const OWNERSHIP_OPTIONS: OwnershipOption[] = [
  { value: "owned", labelKey: "games.listToolbar.filterOwned" },
  { value: "wishlisted", labelKey: "games.listToolbar.filterWishlist" },
];

interface PublicGamesToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  sort: GameSortOption;
  onSortChange: (value: GameSortOption) => void;
  platformOptions: FilterOption[];
  platformIds: number[];
  onPlatformIdsChange: (value: number[]) => void;
  tagOptions: FilterOption[];
  tagIds: number[];
  onTagIdsChange: (value: number[]) => void;

  formats: string[];
  onFormatsChange: (value: string[]) => void;
  playStatuses: string[];
  onPlayStatusesChange: (value: string[]) => void;
  ownershipStatuses: OwnershipStatus[];
  onOwnershipStatusesChange: (value: OwnershipStatus[]) => void;
  onClearFilters: () => void;
}

const FORMAT_OPTIONS = ["physical", "digital", "iso", "rom", "abandonware", "other"];
const PLAY_STATUS_OPTIONS = ["unplayed", "playing", "beaten", "completed", "dropped", "on_hold"];

// Full filter set matching the normal Games page — for the read-only public share page.
const PublicGamesToolbar = ({
  search,
  onSearchChange,
  sort,
  onSortChange,
  platformOptions,
  platformIds,
  onPlatformIdsChange,
  tagOptions,
  tagIds,
  onTagIdsChange,

  formats,
  onFormatsChange,
  playStatuses,
  onPlayStatusesChange,
  ownershipStatuses,
  onOwnershipStatusesChange,
  onClearFilters,
}: PublicGamesToolbarProps) => {
  const { t } = useTranslation();
  // Hide on scroll down, reappear on scroll up.
  const hideSearchBar = useScrollDirection(80);
  const [dialogOpen, setDialogOpen] = useState(false);

  const selectedSortOption =
    GAME_SORT_OPTIONS.find((option) => option.value === sort) ?? GAME_SORT_OPTIONS[0];

  const formatOptions = FORMAT_OPTIONS.map((f) => ({ id: f, name: t(`games.listToolbar.format${f.charAt(0).toUpperCase() + f.slice(1)}`, f) }));
  const playStatusOptions = PLAY_STATUS_OPTIONS.map((s) => ({ id: s, name: t(`games.listToolbar.playStatus${s.charAt(0).toUpperCase() + s.slice(1)}`, s) }));

  return (
    <Box sx={{ display: hideSearchBar ? "none" : "block" }}>
      <Paper sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2 }}>
      <Stack direction="row" spacing={1}>
      <TextField
        label={t("public.games.searchLabel")}
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        fullWidth
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
            endAdornment: search && (
              <InputAdornment position="end" onClick={() => onSearchChange("")}>
                <ClearIcon style={{ cursor: "pointer" }} />
              </InputAdornment>
            ),
          },
        }}
      />
      <Tooltip title={t("public.games.filtersButtonLabel")}>
        <IconButton
          onClick={() => setDialogOpen(true)}
          aria-label={t("public.games.filtersButtonLabel")}
          sx={{ alignSelf: "center" }}
        >
          <FilterListIcon />
        </IconButton>
      </Tooltip>
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t("public.games.filtersButtonLabel")}</DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid size={{ xs: 12 }}>
                <AutocompleteMultiSelect<OwnershipOption>
                  label={t("games.listToolbar.ownershipLabel")}
                  options={OWNERSHIP_OPTIONS}
                  value={OWNERSHIP_OPTIONS.filter((o) => ownershipStatuses.includes(o.value))}
                  onChange={(newValue) => onOwnershipStatusesChange(newValue.map((o) => o.value))}
                  getOptionLabel={(option) => t(option.labelKey)}
                  isOptionEqualToValue={(option, val) => option.value === val.value}
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <AutocompleteMultiSelect<FilterOption>
                  label={t("games.listToolbar.consoleLabel")}
                  options={platformOptions}
                  value={platformOptions.filter((p) => platformIds.includes(p.id))}
                  onChange={(newValue) => onPlatformIdsChange(newValue.map((p) => p.id))}
                  getOptionLabel={(option) => option.name}
                  isOptionEqualToValue={(option, val) => option.id === val.id}
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <AutocompleteMultiSelect<FilterOption>
                  label={t("games.listToolbar.tagLabel")}
                  options={tagOptions}
                  value={tagOptions.filter((p) => tagIds.includes(p.id))}
                  onChange={(newValue) => onTagIdsChange(newValue.map((p) => p.id))}
                  getOptionLabel={(option) => option.name}
                  isOptionEqualToValue={(option, val) => option.id === val.id}
                  fullWidth
                />
              </Grid>


              <Grid size={{ xs: 12 }}>
                <AutocompleteMultiSelect<{ id: string; name: string }>
                  label={t("games.listToolbar.formatLabel")}
                  options={formatOptions}
                  value={formatOptions.filter((p) => formats.includes(p.id))}
                  onChange={(newValue) => onFormatsChange(newValue.map((p) => p.id))}
                  getOptionLabel={(option) => option.name}
                  isOptionEqualToValue={(option, val) => option.id === val.id}
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <AutocompleteMultiSelect<{ id: string; name: string }>
                  label={t("games.listToolbar.playStatusLabel")}
                  options={playStatusOptions}
                  value={playStatusOptions.filter((p) => playStatuses.includes(p.id))}
                  onChange={(newValue) => onPlayStatusesChange(newValue.map((p) => p.id))}
                  getOptionLabel={(option) => option.name}
                  isOptionEqualToValue={(option, val) => option.id === val.id}
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <AutocompleteSelect<GameSortOptionItem>
                  label={t("games.listToolbar.sortByLabel")}
                  options={GAME_SORT_OPTIONS}
                  value={selectedSortOption}
                  onChange={(newValue) => onSortChange(newValue?.value ?? "name_asc")}
                  getOptionLabel={(option) => t(option.labelKey)}
                  isOptionEqualToValue={(option, val) => option.value === val.value}
                  disableClearable
                  fullWidth
                />
              </Grid>
            </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClearFilters} variant="text">
            {t("games.listToolbar.clearFiltersButton")}
          </Button>
          <Button onClick={() => setDialogOpen(false)} variant="contained">
            {t("common.close")}
          </Button>
        </DialogActions>
      </Dialog>
      </Stack>
      </Paper>
    </Box>
  );
};

export default PublicGamesToolbar;
