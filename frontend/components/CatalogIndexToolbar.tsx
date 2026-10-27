import { useState } from "react";
import ClearIcon from "@mui/icons-material/Clear";
import SearchIcon from "@mui/icons-material/Search";
import SortIcon from "@mui/icons-material/Sort";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import { useTranslation } from "react-i18next";
import type { CatalogSortOption } from "../api/types";

interface SortOption {
  value: CatalogSortOption;
  labelKey: string;
}

const SORT_OPTIONS: SortOption[] = [
  { value: "name_asc", labelKey: "games.listToolbar.sortNameAsc" },
  { value: "name_desc", labelKey: "games.listToolbar.sortNameDesc" },
  { value: "count_desc", labelKey: "games.listToolbar.sortMostGames" },
];

interface CatalogIndexToolbarProps {
  searchLabel: string;
  searchPlaceholder: string;
  searchKeyword: string;
  onSearchKeywordChange: (value: string) => void;
  sort: CatalogSortOption;
  onSortChange: (value: CatalogSortOption) => void;
}

// Trimmed sibling of GameListToolbar — Collections/Series/Platforms are just a name +
// game count each, so there's nothing to filter and Sort only offers Name ASC/DESC and
// Most games, as a top-row menu like the games toolbar. No selection-mode toggle either,
// since these index pages have no bulk actions.
const CatalogIndexToolbar = ({
  searchLabel,
  searchPlaceholder,
  searchKeyword,
  onSearchKeywordChange,
  sort,
  onSortChange,
}: CatalogIndexToolbarProps) => {
  const { t } = useTranslation();
  const [sortMenuAnchor, setSortMenuAnchor] = useState<HTMLElement | null>(null);
  const currentSortOption = SORT_OPTIONS.find((option) => option.value === sort);
  const sortTooltip = currentSortOption
    ? t(currentSortOption.labelKey)
    : t("games.listToolbar.sortByLabel");

  // Like the games toolbar, the search bar stays visible on scroll — only the
  // page title above it collapses (see CatalogIndexGrid).
  return (
    <>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", pt: 2 }}>
        <TextField
          label={searchLabel}
          variant="outlined"
          size="small"
          value={searchKeyword}
          onChange={(event) => onSearchKeywordChange(event.target.value)}
          placeholder={searchPlaceholder}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon style={{ cursor: "pointer" }} />
                </InputAdornment>
              ),
              endAdornment: searchKeyword && (
                <InputAdornment position="end">
                  <IconButton
                    aria-label={t("common.clearSearch")}
                    onClick={() => onSearchKeywordChange("")}
                    edge="end"
                    size="small"
                  >
                    <ClearIcon />
                  </IconButton>
                </InputAdornment>
              ),
            },
          }}
          fullWidth
        />
        <Tooltip title={sortTooltip}>
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
      </Stack>
      <Menu
        anchorEl={sortMenuAnchor}
        open={sortMenuAnchor !== null}
        onClose={() => setSortMenuAnchor(null)}
      >
        {SORT_OPTIONS.map((option) => (
          <MenuItem
            key={option.value}
            selected={sort === option.value}
            onClick={() => {
              onSortChange(option.value);
              setSortMenuAnchor(null);
            }}
          >
            {t(option.labelKey)}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

export default CatalogIndexToolbar;
