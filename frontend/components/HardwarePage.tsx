import { useNavigate } from "react-router-dom";
import AddIcon from "@mui/icons-material/Add";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Collapse from "@mui/material/Collapse";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useScrollCollapse } from "../hooks/useScrollCollapse";
import AccessoryList from "./AccessoryList";
import DeviceList from "./DeviceList";
import HardwareSearchBar from "./HardwareSearchBar";
import type { HardwareSort, HardwareStatusFilter } from "./HardwareListToolbar";
import { useSessionState } from "../hooks/useSessionState";

interface HardwarePageProps {
  // A Hardware → Platforms page: the same lists, kept to devices on this platform and
  // accessories compatible with it, with their own search, sort and filters.
  platformId?: number;
  platformName?: string;
}

const HardwarePage = ({ platformId, platformName }: HardwarePageProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  // The platform page keeps its own search, sort and filters apart from the main Hardware
  // page's, so going back and forth doesn't leak one page's state into the other.
  const scope = platformId === undefined ? "hardware" : "hardwarePlatform";
  const [searchKeyword, setSearchKeyword] = useSessionState(`${scope}.searchKeyword`, "");
  const [status, setStatus] = useSessionState<HardwareStatusFilter>(`${scope}.status`, "all");
  const [sort, setSort] = useSessionState<HardwareSort>(`${scope}.sort`, "name");
  const [manufacturerIds, setManufacturerIds] = useSessionState<number[]>(`${scope}.manufacturerIds`, []);
  const [deviceTypeIds, setDeviceTypeIds] = useSessionState<number[]>(`${scope}.deviceTypeIds`, []);
  const [accessoryTypeIds, setAccessoryTypeIds] = useSessionState<number[]>(`${scope}.accessoryTypeIds`, []);
  const [platformIds, setPlatformIds] = useSessionState<number[]>(`${scope}.platformIds`, []);
  // On a platform page the Platform filter is the page itself, so both lists are pinned
  // to it whatever the (hidden) filter holds.
  const pinnedPlatformIds = platformId === undefined ? platformIds : [platformId];

  const debouncedKeyword = useDebouncedValue(searchKeyword.trim(), 500);
  // Sub-nav and title: hidden once scrolled, only return when back at the very top.
  // The search bar itself stays visible, like the games page.
  const hideHeader = useScrollCollapse(10);

  return (
    <>
      <Box
        sx={{
          position: "sticky",
          // Dock exactly under the fixed AppBar like the games page: the old flat
          // mixins.toolbar.minHeight resolved to 56 at every width, so on desktop
          // the stuck bar slid 8px underneath the 64px AppBar.
          top: { xs: 56, sm: 64 },
          zIndex: 1,
          bgcolor: "background.default",
          // Same rhythm as the games page: 4px here + 16px of card padding = 20px
          // above the search field, 16px of card padding below it to the content.
          pt: 0.5,
          pb: 0,
        }}
      >
        <Collapse in={!hideHeader}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 2, mb: 3, flexWrap: "wrap", mt: 2 }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h4" component="h1" gutterBottom>
              {platformName ?? t("hardware.page.title")}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1.5} sx={{ flexShrink: 0, flexWrap: "wrap", rowGap: 1 }}>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate("/hardware/device/add")}>
              {t("hardware.page.addDeviceButton")}
            </Button>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate("/hardware/accessory/add")}>
              {t("hardware.page.addAccessoryButton")}
            </Button>
          </Stack>
        </Box>
        </Collapse>

        <HardwareSearchBar
          searchKeyword={searchKeyword}
          onSearchKeywordChange={setSearchKeyword}
          status={status}
          onStatusChange={setStatus}
          sort={sort}
          onSortChange={setSort}
          manufacturerIds={manufacturerIds}
          onManufacturerIdsChange={setManufacturerIds}
          deviceTypeIds={deviceTypeIds}
          onDeviceTypeIdsChange={setDeviceTypeIds}
          accessoryTypeIds={accessoryTypeIds}
          onAccessoryTypeIdsChange={setAccessoryTypeIds}
          platformIds={platformIds}
          onPlatformIdsChange={setPlatformIds}
          hidePlatform={platformId !== undefined}
        />
      </Box>

      <Stack
        spacing={3}
        sx={{
          // No top margin: the 16px gap to the search card comes from the card's
          // own padding, matching the games page's 16px below its search bar.
          mt: 0,
          // Contains z-index in here to its own stacking context — otherwise MUI's
          // shrunk-label z-index (1, same as the sticky header above) ties with the sticky
          // box's and falls back to DOM order, letting floating labels paint on top of the
          // sticky header instead of staying hidden behind it as the rest of their own
          // component does.
          isolation: "isolate",
        }}
      >
        <Box>
          <Typography variant="h5" component="h2" gutterBottom>
            {t("hardware.page.devicesHeading")}
          </Typography>
          <DeviceList
            searchKeyword={debouncedKeyword}
            status={status}
            sort={sort}
            manufacturerIds={manufacturerIds}
            deviceTypeIds={deviceTypeIds}
            platformIds={pinnedPlatformIds}
          />
        </Box>

        <Box>
          <Typography variant="h5" component="h2" gutterBottom>
            {t("hardware.page.accessoriesHeading")}
          </Typography>
          <AccessoryList
            searchKeyword={debouncedKeyword}
            status={status}
            sort={sort}
            manufacturerIds={manufacturerIds}
            accessoryTypeIds={accessoryTypeIds}
            platformIds={pinnedPlatformIds}
          />
        </Box>
      </Stack>
    </>
  );
};

export default HardwarePage;
