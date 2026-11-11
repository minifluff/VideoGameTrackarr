import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import CheckIcon from "@mui/icons-material/Check";
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import SearchIcon from "@mui/icons-material/Search";
import SortIcon from "@mui/icons-material/Sort";
import Badge from "@mui/material/Badge";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Grid from "@mui/material/Grid";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { usePublicAccessories, usePublicDevices } from "../hooks/usePublic";
import { useScrollDirection } from "../hooks/useScrollCollapse";
import AutocompleteMultiSelect from "./AutocompleteMultiSelect";
import type { HardwareStatusFilter } from "./HardwareListToolbar";
import PublicAccessoryList from "./PublicAccessoryList";
import PublicDeviceList from "./PublicDeviceList";

export type PublicHardwareSort = "name_asc" | "name_desc";

// Search + Sort + Filters, like the private Hardware page — but the public
// payload carries no release dates or device/accessory type names, so sort is
// name only and the filters are status, manufacturer, and (devices) platform,
// all applied client-side to the fetched items. The lookups the private bar
// uses are authenticated endpoints that would 401 for a public visitor, so
// the option lists are derived from the items themselves.
const PublicHardwarePage = () => {
  const { token } = useParams<{ token: string }>();
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<PublicHardwareSort>("name_asc");
  const [status, setStatus] = useState<HardwareStatusFilter>("all");
  const [manufacturerNames, setManufacturerNames] = useState<string[]>([]);
  const [platformNames, setPlatformNames] = useState<string[]>([]);
  const [sortMenuAnchor, setSortMenuAnchor] = useState<HTMLElement | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const debouncedSearch = useDebouncedValue(search.trim(), 500);
  // Hide on scroll down, reappear on scroll up.
  const hideSearchBar = useScrollDirection(80);

  // Same queries as the two lists below, so the cache is shared and nothing
  // fetches twice — these only derive the filter options.
  const { data: devices = [] } = usePublicDevices(token, debouncedSearch || undefined);
  const { data: accessories = [] } = usePublicAccessories(token, debouncedSearch || undefined);
  const manufacturers = useMemo(
    () =>
      [...new Set([...devices, ...accessories].map((item) => item.manufacturerName))].sort(),
    [devices, accessories]
  );
  const platforms = useMemo(
    () =>
      [
        ...new Set(
          devices
            .map((device) => device.hardwarePlatformName)
            .filter((name): name is string => name !== null)
        ),
      ].sort(),
    [devices]
  );

  const sortOptions: { value: PublicHardwareSort; label: string }[] = [
    {
      value: "name_asc",
      label: `${t("hardware.listToolbar.sortOptionName")} (${t("games.listView.sortAscending")})`,
    },
    {
      value: "name_desc",
      label: `${t("hardware.listToolbar.sortOptionName")} (${t("games.listView.sortDescending")})`,
    },
  ];
  const statusOptions: { value: HardwareStatusFilter; label: string }[] = [
    { value: "all", label: t("hardware.searchBar.statusAll") },
    { value: "owned", label: t("hardware.detailsShared.statusOwned") },
    { value: "wishlist", label: t("hardware.detailsShared.statusWishlist") },
  ];
  const activeFilterCount =
    (status !== "all" ? 1 : 0) + manufacturerNames.length + platformNames.length;
  const manufacturerOptions = manufacturers.map((name) => ({ id: name, name }));
  const platformOptions = platforms.map((name) => ({ id: name, name }));

  return (
    <>
      <Box
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 1,
          bgcolor: "background.default",
          pt: hideSearchBar ? 0 : 0.5,
          pb: hideSearchBar ? 0 : 1,
        }}
      >
      <Typography variant="h4" component="h1" gutterBottom>
        {t("public.hardware.title")}
      </Typography>
      <Box sx={{ display: hideSearchBar ? "none" : "block" }}>
        <Paper sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2 }}>
        <Stack direction="row" spacing={1}>
        <TextField
          label={t("public.hardware.searchLabel")}
          size="small"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          fullWidth
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            },
          }}
        />
        <Tooltip title={t("hardware.listToolbar.sortByLabel")}>
          <IconButton
            onClick={(event) => setSortMenuAnchor(event.currentTarget)}
            aria-label={t("hardware.listToolbar.sortByLabel")}
            aria-haspopup="menu"
            aria-expanded={sortMenuAnchor !== null}
            sx={{ alignSelf: "center" }}
          >
            <SortIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title={t("hardware.searchBar.filtersButtonLabel")}>
          <IconButton
            onClick={() => setFiltersOpen(true)}
            aria-label={t("hardware.searchBar.filtersButtonLabel")}
            sx={{ alignSelf: "center" }}
          >
            <Badge badgeContent={activeFilterCount} color="primary">
              <FilterAltIcon />
            </Badge>
          </IconButton>
        </Tooltip>
        </Stack>
        </Paper>
        <Menu
          anchorEl={sortMenuAnchor}
          open={sortMenuAnchor !== null}
          onClose={() => setSortMenuAnchor(null)}
        >
          {sortOptions.map((option) => {
            const selected = option.value === sort;
            return (
              <MenuItem
                key={option.value}
                selected={selected}
                onClick={() => {
                  setSort(option.value);
                  setSortMenuAnchor(null);
                }}
              >
                <ListItemText>{option.label}</ListItemText>
                {selected ? <CheckIcon fontSize="small" color="primary" sx={{ ml: 2 }} /> : null}
              </MenuItem>
            );
          })}
        </Menu>
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
                  onClick={() => setStatus(option.value)}
                />
              ))}
            </Box>
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid size={{ xs: 12 }}>
                <AutocompleteMultiSelect<{ id: string; name: string }>
                  label={t("hardware.listToolbar.manufacturerLabel")}
                  options={manufacturerOptions}
                  value={manufacturerOptions.filter((option) =>
                    manufacturerNames.includes(option.id)
                  )}
                  onChange={(newValue) => setManufacturerNames(newValue.map((o) => o.id))}
                  getOptionLabel={(option) => option.name}
                  isOptionEqualToValue={(option, val) => option.id === val.id}
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <AutocompleteMultiSelect<{ id: string; name: string }>
                  label={t("hardware.listToolbar.platformLabel")}
                  options={platformOptions}
                  value={platformOptions.filter((option) => platformNames.includes(option.id))}
                  onChange={(newValue) => setPlatformNames(newValue.map((o) => o.id))}
                  getOptionLabel={(option) => option.name}
                  isOptionEqualToValue={(option, val) => option.id === val.id}
                  fullWidth
                />
              </Grid>
            </Grid>
          </DialogContent>
        </Dialog>
      </Box>
      </Box>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h5" component="h2" gutterBottom>
            {t("public.hardware.devicesHeading")}
          </Typography>
          <PublicDeviceList
            token={token}
            search={debouncedSearch}
            sort={sort}
            status={status}
            manufacturerNames={manufacturerNames}
            platformNames={platformNames}
          />
        </Box>
        <Box>
          <Typography variant="h5" component="h2" gutterBottom>
            {t("public.hardware.accessoriesHeading")}
          </Typography>
          <PublicAccessoryList
            token={token}
            search={debouncedSearch}
            sort={sort}
            status={status}
            manufacturerNames={manufacturerNames}
          />
        </Box>
      </Stack>
    </>
  );
};

export default PublicHardwarePage;
