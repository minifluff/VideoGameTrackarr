import { useNavigate } from "react-router-dom";
import AddIcon from "@mui/icons-material/Add";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Collapse from "@mui/material/Collapse";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useScrollCollapse, useScrollDirection } from "../hooks/useScrollCollapse";
import AccessoryList from "./AccessoryList";
import DeviceList from "./DeviceList";
import HardwareSearchBar from "./HardwareSearchBar";
import type { HardwareSort, HardwareStatusFilter } from "./HardwareListToolbar";
import { useSessionState } from "../hooks/useSessionState";

const HardwarePage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchKeyword, setSearchKeyword] = useSessionState("hardware.searchKeyword", "");
  const [status, setStatus] = useSessionState<HardwareStatusFilter>("hardware.status", "all");
  const [sort, setSort] = useSessionState<HardwareSort>("hardware.sort", "name");
  const [manufacturerIds, setManufacturerIds] = useSessionState<number[]>("hardware.manufacturerIds", []);
  const [deviceTypeIds, setDeviceTypeIds] = useSessionState<number[]>("hardware.deviceTypeIds", []);
  const [accessoryTypeIds, setAccessoryTypeIds] = useSessionState<number[]>("hardware.accessoryTypeIds", []);
  const [platformIds, setPlatformIds] = useSessionState<number[]>("hardware.platformIds", []);

  const debouncedKeyword = useDebouncedValue(searchKeyword.trim(), 500);
  // Sub-nav and title: hidden once scrolled, only return when back at the very top.
  const hideHeader = useScrollCollapse(10);
  // Search bar: hides on scroll down, reappears on scroll up.
  const hideSearchBar = useScrollDirection(80);

  return (
    <>
      <Box
        sx={{
          position: "sticky",
          top: (theme) => theme.mixins.toolbar.minHeight,
          zIndex: 1,
          bgcolor: "background.default",
          // When the search bar is hidden, collapse the container completely.
          pt: hideSearchBar ? 0 : 0.5,
          pb: hideSearchBar ? 0 : 1,
          // Once scrolled content locks under this sticky header, the bottom edge needs to
          // read as an intentional floating panel — otherwise half-covered floating labels
          // (Manufacturer/Device type/etc.) look like clipped/broken text rather than
          // content sitting behind a layer.
          boxShadow: "0 4px 8px -4px rgba(0, 0, 0, 0.2)",
        }}
      >
        <Collapse in={!hideHeader}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 2, mb: 3, flexWrap: "wrap", mt: 2 }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h4" component="h1" gutterBottom>
              {t("hardware.page.title")}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t("hardware.page.subtitle")}
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

        <Box sx={{ display: hideSearchBar ? "none" : "block" }}>
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
        />
        </Box>
      </Box>

      <Stack
        spacing={3}
        sx={{
          mt: 3,
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
            platformIds={platformIds}
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
            platformIds={platformIds}
          />
        </Box>
      </Stack>
    </>
  );
};

export default HardwarePage;
