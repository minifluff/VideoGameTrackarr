import { useTranslation } from "react-i18next";
import { useCollections } from "../hooks/useCatalogBrowse";
import { isAllHiddenCatalogRef } from "../utils/showHiddenGames";
import CatalogIndexGrid from "./CatalogIndexGrid";

const CollectionsPage = () => {
  const { t } = useTranslation();
  const { data: collections, isLoading } = useCollections();

  return (
    <>
      <CatalogIndexGrid
        stateKey="collections"
        title={t("games.collectionsPage.title")}
        emptyMessage={t("games.collectionsPage.emptyMessage")}
        searchLabel={t("games.collectionsPage.searchLabel")}
        searchPlaceholder={t("games.collectionsPage.searchPlaceholder")}
        entries={collections}
        isLoading={isLoading}
        getCount={(entry) => entry.gameCount}
        isAllHidden={isAllHiddenCatalogRef}
        showMinGamesFilter
        getHref={(entry) => `/games/collections/${entry.slug ?? ""}`}
      />
    </>
  );
};

export default CollectionsPage;
