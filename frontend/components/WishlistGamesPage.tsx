import { useTranslation } from "react-i18next";
import GameList from "./GameList";
import GamesSubNav from "./GamesSubNav";

const WishlistGamesPage = () => {
  const { t } = useTranslation();

  return (
    <>
      <GamesSubNav />
      <GameList
        sessionPrefix="games-wishlist"
        initialOwnershipStatuses={["wishlisted"]}
        subNav={<></>}
      />
    </>
  );
};

export default WishlistGamesPage;
