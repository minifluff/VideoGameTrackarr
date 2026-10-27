import { useState } from "react";
import ClearIcon from "@mui/icons-material/Clear";
import SearchIcon from "@mui/icons-material/Search";
import SortIcon from "@mui/icons-material/Sort";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Collapse from "@mui/material/Collapse";
import { useTranslation } from "react-i18next";
import { useScrollCollapse } from "../hooks/useScrollCollapse";
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
  const collapsed = useScrollCollapse(80);
  const [sortMenuAnchor, setSortMenuAnchor] = useState<HTMLElement | null>(null);

  return (
    <Collapse in={!collapsed} timeout={200}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 3 }}>
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
        <Button
          startIcon={<SortIcon />}
          onClick={(event) => setSortMenuAnchor(event.currentTarget)}
          aria-haspopup="menu"
          aria-expanded={sortMenuAnchor !== null}
          sx={{ flexShrink: 0 }}
        >
          {t("games.listToolbar.sortByLabel")}
        </Button>
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
    </Collapse>
  );
};

export default CatalogIndexToolbar;
