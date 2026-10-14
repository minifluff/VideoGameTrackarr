import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import GameList from "./GameList";
import GamesSubNav from "./GamesSubNav";

const WishlistGamesPage = () => {
  const { t } = useTranslation();

  // Pre-select the wishlist ownership filter on first visit
  useEffect(() => {
    const key = "games-wishlist.ownershipStatuses";
    if (!sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, JSON.stringify(["wishlisted"]));
    }
  }, []);

  return (
    <>
      <GamesSubNav />
      <GameList
        sessionPrefix="games-wishlist"
        subNav={<></>}
      />
    </>
  );
};

export default WishlistGamesPage;
