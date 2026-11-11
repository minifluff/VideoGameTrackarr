import { useMemo } from "react";
import Paper from "@mui/material/Paper";
import { useTranslation } from "react-i18next";
import { usePublicDevices } from "../hooks/usePublic";
import HardwareCard from "./HardwareCard";
import type { HardwareStatusFilter } from "./HardwareListToolbar";
import VirtualGameGrid from "./VirtualGameGrid";

interface PublicDeviceListProps {
  token: string | undefined;
  search: string;
  sort: "name_asc" | "name_desc";
  status: HardwareStatusFilter;
  manufacturerNames: string[];
  platformNames: string[];
}

// Deliberately not DeviceList.tsx reused — that component renders the full
// HardwareListToolbar, whose filter dropdowns are backed by authenticated lookup
// endpoints that would 401 for an anonymous public-page visitor.
const PublicDeviceList = ({
  token,
  search,
  sort,
  status,
  manufacturerNames,
  platformNames,
}: PublicDeviceListProps) => {
  const { t } = useTranslation();
  const { data: devices, isLoading } = usePublicDevices(token, search || undefined);

  // Filters and sort run client-side on the fetched items — the public
  // endpoint takes only a search term.
  const visibleDevices = useMemo(() => {
    let result = devices ?? [];
    if (status !== "all") {
      result = result.filter((device) => (status === "owned" ? device.owned : device.wishlisted));
    }
    if (manufacturerNames.length > 0) {
      result = result.filter((device) => manufacturerNames.includes(device.manufacturerName));
    }
    if (platformNames.length > 0) {
      result = result.filter(
        (device) =>
          device.hardwarePlatformName !== null &&
          platformNames.includes(device.hardwarePlatformName)
      );
    }
    return [...result].sort((a, b) =>
      sort === "name_asc"
        ? a.officialName.localeCompare(b.officialName)
        : b.officialName.localeCompare(a.officialName)
    );
  }, [devices, sort, status, manufacturerNames, platformNames]);

  if (isLoading) {
    return <Paper sx={{ p: 3, textAlign: "center" }}>{t("common.loading")}</Paper>;
  }
  if (!devices || visibleDevices.length === 0) {
    return <Paper sx={{ p: 3, textAlign: "center" }}>{t("public.hardware.emptyState")}</Paper>;
  }

  return (
    <VirtualGameGrid
      items={visibleDevices}
      getKey={(device) => device.id}
      renderItem={(device) => (
        <HardwareCard
          name={device.officialName}
          subtitle={[device.manufacturerName, device.hardwarePlatformName].filter(Boolean).join(" · ")}
          imageUrl={device.imageUrl}
          owned={device.owned}
          wishlisted={device.wishlisted}
          ownedQuantity={device.ownedQuantity}
          isCustom={device.isCustom}
        />
      )}
    />
  );
};

export default PublicDeviceList;
