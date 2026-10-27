import { useTranslation } from "react-i18next";
import GameList from "./GameList";
import type { OwnershipStatus } from "./GameListToolbar";

// Module-level so the forced scope keeps a stable identity across renders.
const WISHLISTED: OwnershipStatus[] = ["wishlisted"];

const WishlistGamesPage = () => {
  const { t } = useTranslation();
  return (
    <GameList
      sessionPrefix="games-wishlist"
      forcedOwnershipStatuses={WISHLISTED}
      title={t("nav.wishlist")}
    />
  );
};

export default WishlistGamesPage;
