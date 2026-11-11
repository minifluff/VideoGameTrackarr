import { useState } from "react";
import CheckIcon from "@mui/icons-material/Check";
import ClearIcon from "@mui/icons-material/Clear";
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import SearchIcon from "@mui/icons-material/Search";
import SortIcon from "@mui/icons-material/Sort";
import TuneIcon from "@mui/icons-material/Tune";
import Badge from "@mui/material/Badge";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Grid from "@mui/material/Grid";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Slider from "@mui/material/Slider";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { useScrollDirection } from "../hooks/useScrollCollapse";
import type { GameSortOption } from "../api/types";
import { GAME_SORT_FIELDS, makeGameSort, PUBLIC_SORT_FIELDS } from "../utils/gameSortOptions";
import AutocompleteMultiSelect from "./AutocompleteMultiSelect";

interface FilterOption {
  id: number;
  name: string;
}

// Platforms carry their browsable-game count (same source as the private list), so
// the filter can hide zero-game platforms like the main toolbar does.
interface PublicPlatformOption {
  id: number;
  name: string;
  gameCount: number;
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
  platformOptions: PublicPlatformOption[];
  platformIds: number[];
  onPlatformIdsChange: (value: number[]) => void;
  tagOptions: FilterOption[];
  tagIds: number[];
  onTagIdsChange: (value: number[]) => void;
  genreOptions: FilterOption[];
  genreIds: number[];
  onGenreIdsChange: (value: number[]) => void;
  gameModeOptions: string[];
  gameModes: string[];
  onGameModesChange: (value: string[]) => void;

  formats: string[];
  onFormatsChange: (value: string[]) => void;
  playStatuses: string[];
  onPlayStatusesChange: (value: string[]) => void;
  ownershipStatuses: OwnershipStatus[];
  onOwnershipStatusesChange: (value: OwnershipStatus[]) => void;
  onClearFilters: () => void;
  // Per-page card size, like the main toolbar — when absent the grid's
  // default applies and the Options button hides.
  cardSize?: number;
  onCardSizeChange?: (value: number) => void;
}

const FORMAT_OPTIONS = ["physical", "digital", "iso", "rom", "abandonware", "subscription", "other"];
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
  genreOptions,
  genreIds,
  onGenreIdsChange,
  gameModeOptions,
  gameModes,
  onGameModesChange,

  formats,
  onFormatsChange,
  playStatuses,
  onPlayStatusesChange,
  ownershipStatuses,
  onOwnershipStatusesChange,
  onClearFilters,
  cardSize,
  onCardSizeChange,
}: PublicGamesToolbarProps) => {
  const { t } = useTranslation();
  // Hide on scroll down, reappear on scroll up.
  const hideSearchBar = useScrollDirection(80);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sortMenuAnchor, setSortMenuAnchor] = useState<HTMLElement | null>(null);
  const [optionsMenuAnchor, setOptionsMenuAnchor] = useState<HTMLElement | null>(null);
  // Like the main toolbar: the dropdown lists only platforms with games, while
  // already-selected platforms still resolve from the full list, so an active
  // filter is never stranded invisible if its count drops to zero.
  const platformFilterOptions = platformOptions.filter((p) => p.gameCount > 0);

  const activeFilterCount =
    platformIds.length +
    tagIds.length +
    genreIds.length +
    gameModes.length +
    formats.length +
    playStatuses.length +
    ownershipStatuses.length;

  // The share page offers only the fields it shows; each comes in both directions,
  // labelled "Field (Ascending)" like the main toolbar's tooltip.
  const publicSortOptions = PUBLIC_SORT_FIELDS.flatMap((field) =>
    (["asc", "desc"] as const).map((direction) => ({
      value: makeGameSort(field, direction),
      label: `${t(GAME_SORT_FIELDS.find((option) => option.field === field)?.labelKey ?? "games.listToolbar.sortByLabel")} (${t(direction === "asc" ? "games.listView.sortAscending" : "games.listView.sortDescending")})`,
    }))
  );
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
      {cardSize !== undefined && onCardSizeChange !== undefined ? (
        <Tooltip title={t("games.listToolbar.optionsButton")}>
          <IconButton
            onClick={(event) => setOptionsMenuAnchor(event.currentTarget)}
            aria-label={t("games.listToolbar.optionsButton")}
            aria-haspopup="menu"
            aria-expanded={optionsMenuAnchor !== null}
            sx={{ alignSelf: "center" }}
          >
            <TuneIcon />
          </IconButton>
        </Tooltip>
      ) : null}
      <Tooltip title={t("games.listToolbar.sortByLabel")}>
        <IconButton
          onClick={(event) => setSortMenuAnchor(event.currentTarget)}
          aria-label={t("games.listToolbar.sortByLabel")}
          aria-haspopup="menu"
          aria-expanded={sortMenuAnchor !== null}
          sx={{ alignSelf: "center" }}
        >
          <SortIcon />
        </IconButton>
      </Tooltip>
      <Tooltip title={t("games.listToolbar.filtersButtonLabel")}>
        <IconButton
          onClick={() => setDialogOpen(true)}
          aria-label={t("games.listToolbar.filtersButtonLabel")}
          sx={{ alignSelf: "center" }}
        >
          <Badge badgeContent={activeFilterCount} color="primary">
            <FilterAltIcon />
          </Badge>
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={optionsMenuAnchor}
        open={optionsMenuAnchor !== null}
        onClose={() => setOptionsMenuAnchor(null)}
      >
        <Box sx={{ px: 2, py: 1.5, width: 240 }}>
          <Typography variant="subtitle2" gutterBottom>
            {t("settings.appearance.cardSize")}
          </Typography>
          <Box sx={{ px: 1 }}>
            <Slider
              value={cardSize ?? 1.0}
              onChange={(_event, value) => onCardSizeChange?.(value as number)}
              min={0.5}
              max={2.0}
              step={0.1}
              marks={[
                { value: 0.5, label: t("settings.appearance.cardSizeSmall") },
                { value: 1.0, label: t("settings.appearance.cardSizeMedium") },
                { value: 2.0, label: t("settings.appearance.cardSizeLarge") },
              ]}
              valueLabelDisplay="auto"
              valueLabelFormat={(value) => `${Math.round(value * 100)}%`}
              aria-label={t("settings.appearance.cardSize")}
            />
          </Box>
          <Typography variant="caption" color="text.secondary">
            {t("games.listToolbar.cardSizePageNote")}
          </Typography>
        </Box>
      </Menu>
      <Menu
        anchorEl={sortMenuAnchor}
        open={sortMenuAnchor !== null}
        onClose={() => setSortMenuAnchor(null)}
      >
        {publicSortOptions.map((option) => {
          const selected = option.value === sort;
          return (
            <MenuItem
              key={option.value}
              selected={selected}
              onClick={() => {
                onSortChange(option.value);
                setSortMenuAnchor(null);
              }}
            >
              <ListItemText>{option.label}</ListItemText>
              {selected ? <CheckIcon fontSize="small" color="primary" sx={{ ml: 2 }} /> : null}
            </MenuItem>
          );
        })}
      </Menu>
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t("games.listToolbar.filtersButtonLabel")}</DialogTitle>
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
                <AutocompleteMultiSelect<PublicPlatformOption>
                  label={t("games.listToolbar.consoleLabel")}
                  options={platformFilterOptions}
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
                <AutocompleteMultiSelect<FilterOption>
                  label={t("games.listToolbar.genreLabel")}
                  options={genreOptions}
                  value={genreOptions.filter((p) => genreIds.includes(p.id))}
                  onChange={(newValue) => onGenreIdsChange(newValue.map((p) => p.id))}
                  getOptionLabel={(option) => option.name}
                  isOptionEqualToValue={(option, val) => option.id === val.id}
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <AutocompleteMultiSelect<{ id: string; name: string }>
                  label={t("games.listToolbar.gameModeLabel")}
                  options={gameModeOptions.map((mode) => ({ id: mode, name: mode }))}
                  value={gameModeOptions
                    .filter((mode) => gameModes.includes(mode))
                    .map((mode) => ({ id: mode, name: mode }))}
                  onChange={(newValue) => onGameModesChange(newValue.map((p) => p.id))}
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
