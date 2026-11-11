import { useMemo } from "react";
import Paper from "@mui/material/Paper";
import { useTranslation } from "react-i18next";
import { usePublicAccessories } from "../hooks/usePublic";
import HardwareCard from "./HardwareCard";
import type { HardwareStatusFilter } from "./HardwareListToolbar";
import VirtualGameGrid from "./VirtualGameGrid";

interface PublicAccessoryListProps {
  token: string | undefined;
  search: string;
  sort: "name_asc" | "name_desc";
  status: HardwareStatusFilter;
  manufacturerNames: string[];
}

// Deliberately not AccessoryList.tsx reused — same reasoning as PublicDeviceList.tsx.
const PublicAccessoryList = ({
  token,
  search,
  sort,
  status,
  manufacturerNames,
}: PublicAccessoryListProps) => {
  const { t } = useTranslation();
  const { data: accessories, isLoading } = usePublicAccessories(token, search || undefined);

  // Filters and sort run client-side on the fetched items — the public
  // endpoint takes only a search term.
  const visibleAccessories = useMemo(() => {
    let result = accessories ?? [];
    if (status !== "all") {
      result = result.filter((accessory) =>
        status === "owned" ? accessory.owned : accessory.wishlisted
      );
    }
    if (manufacturerNames.length > 0) {
      result = result.filter((accessory) => manufacturerNames.includes(accessory.manufacturerName));
    }
    return [...result].sort((a, b) =>
      sort === "name_asc"
        ? a.officialName.localeCompare(b.officialName)
        : b.officialName.localeCompare(a.officialName)
    );
  }, [accessories, sort, status, manufacturerNames]);

  if (isLoading) {
    return <Paper sx={{ p: 3, textAlign: "center" }}>{t("common.loading")}</Paper>;
  }
  if (!accessories || visibleAccessories.length === 0) {
    return <Paper sx={{ p: 3, textAlign: "center" }}>{t("public.hardware.emptyState")}</Paper>;
  }

  return (
    <VirtualGameGrid
      items={visibleAccessories}
      getKey={(accessory) => accessory.id}
      renderItem={(accessory) => (
        <HardwareCard
          name={accessory.officialName}
          subtitle={accessory.manufacturerName}
          imageUrl={accessory.imageUrl}
          owned={accessory.owned}
          wishlisted={accessory.wishlisted}
          ownedQuantity={accessory.ownedQuantity}
          isCustom={accessory.isCustom}
        />
      )}
    />
  );
};

export default PublicAccessoryList;
