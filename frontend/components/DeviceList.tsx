import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import { useTranslation } from "react-i18next";
import { useDeviceList } from "../hooks/useDevice";
import { hardwareIdentifier } from "../utils/identifiers";
import HardwareCard from "./HardwareCard";
import type { HardwareSort, HardwareStatusFilter } from "./HardwareListToolbar";
import VirtualGameGrid from "./VirtualGameGrid";

interface DeviceListProps {
  searchKeyword: string;
  status: HardwareStatusFilter;
  sort: HardwareSort;
  manufacturerIds: number[];
  deviceTypeIds: number[];
  platformIds: number[];
}

const DeviceList = ({ searchKeyword, status, sort, manufacturerIds, deviceTypeIds, platformIds }: DeviceListProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data: devices, isLoading } = useDeviceList({
    search: searchKeyword || undefined,
    manufacturerIds: manufacturerIds.length > 0 ? manufacturerIds : undefined,
    deviceTypeIds: deviceTypeIds.length > 0 ? deviceTypeIds : undefined,
    hardwarePlatformIds: platformIds.length > 0 ? platformIds : undefined,
    status: status === "all" ? undefined : status,
  });

  // Devices have no release-date field of their own to sort by (it lives on the linked
  // HardwareReferenceEntry instead) — "Release date" in the shared toolbar is a no-op here.
  const sortedDevices = useMemo(() => {
    if (!devices) return [];
    const items = [...devices];
    items.sort((a, b) => a.officialName.localeCompare(b.officialName));
    return items;
  }, [devices]);

  return (
    <Stack spacing={2}>
      {isLoading ? (
        <Paper sx={{ p: 3, textAlign: "center" }}>{t("common.loading")}</Paper>
      ) : sortedDevices.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: "center" }}>{t("hardware.deviceList.emptyState")}</Paper>
      ) : (
        <VirtualGameGrid
          items={sortedDevices}
          getKey={(item) => item.id}
          renderItem={(item) => (
            <HardwareCard
              name={item.officialName}
              subtitle={[item.manufacturerName, item.hardwarePlatformName].filter(Boolean).join(" · ")}
              imageUrl={item.imageUrl}
              owned={item.owned}
              wishlisted={item.wishlisted}
              ownedQuantity={item.ownedQuantity}
              onClick={() => navigate(`/hardware/device/${hardwareIdentifier(item.officialName, item.uuid)}`)}
            />
          )}
        />
      )}
    </Stack>
  );
};

export default DeviceList;
