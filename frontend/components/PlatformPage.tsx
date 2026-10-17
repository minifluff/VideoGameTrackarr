import { useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { usePlatform } from "../hooks/useCatalogBrowse";
import { parsePlatformScope, platformDisplayName } from "../utils/platformScope";
import CatalogBrowseGrid from "./CatalogBrowseGrid";
import NotFoundPage from "./NotFoundPage";

const PlatformPage = () => {
  const { t } = useTranslation();
  const { platformSlug } = useParams<{ platformSlug: string }>();
  const [searchParams] = useSearchParams();
  // A PC storefront card's page: ?format=digital&storefront=Steam.
  const scope = parsePlatformScope(searchParams);
  const { data, isLoading, isError } = usePlatform(platformSlug);

  if (isError) {
    return (
      <NotFoundPage
        title={t("errors.platformNotFoundTitle")}
        message={t("errors.notFoundMessage")}
        actionLabel={t("errors.backTo", { page: t("nav.platforms") })}
        actionTo="/games/platforms"
      />
    );
  }

  return (
    <CatalogBrowseGrid
      kindLabel={t("games.platformPage.kindLabel")}
      name={data ? platformDisplayName({ name: data.name, abbreviation: null }, scope, t) : undefined}
      entityId={data?.id}
      isLoading={isLoading}
      slug={platformSlug}
      lockedPlatformId={data?.id}
      platformScope={scope}
    />
  );
};

export default PlatformPage;
