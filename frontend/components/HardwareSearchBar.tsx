import { useState } from "react";
import ClearIcon from "@mui/icons-material/Clear";
import FilterListIcon from "@mui/icons-material/FilterList";
import SearchIcon from "@mui/icons-material/Search";
import Badge from "@mui/material/Badge";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Grid from "@mui/material/Grid";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import { useTranslation } from "react-i18next";
import type { NamedLookup } from "../api/types";
import { useAccessoryTypes, useDeviceTypes, useHardwarePlatforms, useManufacturers } from "../hooks/useHardwareLookups";
import AutocompleteMultiSelect from "./AutocompleteMultiSelect";
import AutocompleteSelect from "./AutocompleteSelect";
import type { HardwareSort, HardwareStatusFilter } from "./HardwareListToolbar";

interface SortOption {
  value: HardwareSort;
  label: string;
}

interface LookupFilterProps {
  label: string;
  options: NamedLookup[];
  value: number[];
  onChange: (value: number[]) => void;
  placeholder: string;
}

const LookupFilter = ({ label, options, value, onChange, placeholder }: LookupFilterProps) => (
  <AutocompleteMultiSelect<NamedLookup>
    label={label}
    options={options}
    value={options.filter((option) => value.includes(option.id))}
    onChange={(newValue) => onChange(newValue.map((option) => option.id))}
    getOptionLabel={(option) => option.name}
    isOptionEqualToValue={(option, val) => option.id === val.id}
    placeholder={placeholder}
    fullWidth
  />
);

interface HardwareSearchBarProps {
  searchKeyword: string;
  onSearchKeywordChange: (value: string) => void;
  status: HardwareStatusFilter;
  onStatusChange: (status: HardwareStatusFilter) => void;
  sort: HardwareSort;
  onSortChange: (sort: HardwareSort) => void;
  manufacturerIds: number[];
  onManufacturerIdsChange: (ids: number[]) => void;
  deviceTypeIds: number[];
  onDeviceTypeIdsChange: (ids: number[]) => void;
  accessoryTypeIds: number[];
  onAccessoryTypeIdsChange: (ids: number[]) => void;
  platformIds: number[];
  onPlatformIdsChange: (ids: number[]) => void;
}

// Search + status in the bar, filters & sort behind a filter button that opens a
// dialog — like the games page toolbar. Device types and Accessory types are
// different vocabularies, so they get their own fields in the dialog.
const HardwareSearchBar = ({
  searchKeyword,
  onSearchKeywordChange,
  status,
  onStatusChange,
  sort,
  onSortChange,
  manufacturerIds,
  onManufacturerIdsChange,
  deviceTypeIds,
  onDeviceTypeIdsChange,
  accessoryTypeIds,
  onAccessoryTypeIdsChange,
  platformIds,
  onPlatformIdsChange,
}: HardwareSearchBarProps) => {
  const { t } = useTranslation();
  const [filtersOpen, setFiltersOpen] = useState(false);

  const { data: manufacturers } = useManufacturers();
  const { data: deviceTypes } = useDeviceTypes();
  const { data: accessoryTypes } = useAccessoryTypes();
  const { data: hardwarePlatforms } = useHardwarePlatforms();

  const statusOptions: { value: HardwareStatusFilter; label: string }[] = [
    { value: "all", label: t("hardware.searchBar.statusAll") },
    { value: "owned", label: t("hardware.detailsShared.statusOwned") },
    { value: "wishlist", label: t("hardware.detailsShared.statusWishlist") },
  ];

  const sortOptions: SortOption[] = [
    { value: "name", label: t("hardware.listToolbar.sortOptionName") },
    { value: "releaseDate", label: t("hardware.listToolbar.sortOptionReleaseDate") },
  ];

  const allPlaceholder = t("hardware.listToolbar.allOption");
  const activeFilterCount =
    manufacturerIds.length + deviceTypeIds.length + accessoryTypeIds.length + platformIds.length;

  return (
    <Paper sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2 }}>
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1}>
          <TextField
            label={t("common.search")}
            variant="outlined"
            value={searchKeyword}
            onChange={(event) => onSearchKeywordChange(event.target.value)}
            placeholder={t("hardware.searchBar.searchPlaceholder")}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon style={{ cursor: "pointer" }} />
                  </InputAdornment>
                ),
                endAdornment: searchKeyword && (
                  <InputAdornment position="end" onClick={() => onSearchKeywordChange("")}>
                    <ClearIcon style={{ cursor: "pointer" }} />
                  </InputAdornment>
                ),
              },
            }}
            fullWidth
          />
          <Tooltip title={t("hardware.searchBar.filtersButtonLabel")}>
            <IconButton
              onClick={() => setFiltersOpen(true)}
              aria-label={t("hardware.searchBar.filtersButtonLabel")}
              sx={{ alignSelf: "center" }}
            >
              <Badge badgeContent={activeFilterCount} color="primary">
                <FilterListIcon />
              </Badge>
            </IconButton>
          </Tooltip>
        </Stack>
        <Dialog
          open={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          fullWidth
          maxWidth="xs"
          slotProps={{ paper: { sx: { m: 2, width: "calc(100% - 32px)" } } }}
        >
          <DialogTitle>{t("hardware.searchBar.filtersButtonLabel")}</DialogTitle>
          <DialogContent>
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 2 }}>
              {statusOptions.map((option) => (
                <Chip
                  key={option.value}
                  label={option.label}
                  color={status === option.value ? "primary" : "default"}
                  variant={status === option.value ? "filled" : "outlined"}
                  onClick={() => onStatusChange(option.value)}
                />
              ))}
            </Box>
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid size={{ xs: 12 }}>
                <LookupFilter
                  label={t("hardware.listToolbar.manufacturerLabel")}
                  options={manufacturers ?? []}
                  value={manufacturerIds}
                  onChange={onManufacturerIdsChange}
                  placeholder={allPlaceholder}
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <LookupFilter
                  label={t("hardware.deviceList.typeLabel")}
                  options={deviceTypes ?? []}
                  value={deviceTypeIds}
                  onChange={onDeviceTypeIdsChange}
                  placeholder={allPlaceholder}
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <LookupFilter
                  label={t("hardware.accessoryList.typeLabel")}
                  options={accessoryTypes ?? []}
                  value={accessoryTypeIds}
                  onChange={onAccessoryTypeIdsChange}
                  placeholder={allPlaceholder}
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <LookupFilter
                  label={t("hardware.listToolbar.platformLabel")}
                  options={hardwarePlatforms ?? []}
                  value={platformIds}
                  onChange={onPlatformIdsChange}
                  placeholder={allPlaceholder}
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <AutocompleteSelect<SortOption>
                  label={t("hardware.listToolbar.sortByLabel")}
                  options={sortOptions}
                  value={sortOptions.find((option) => option.value === sort) ?? null}
                  onChange={(newValue) => onSortChange(newValue!.value)}
                  getOptionLabel={(option) => option.label}
                  isOptionEqualToValue={(option, val) => option.value === val.value}
                  disableClearable
                  fullWidth
                />
              </Grid>
            </Grid>
          </DialogContent>
        </Dialog>
      </Stack>
    </Paper>
  );
};

export default HardwareSearchBar;
