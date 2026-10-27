import GameList from "./GameList";

const WishlistGamesPage = () => {
  return (
    <GameList
      sessionPrefix="games-wishlist"
      initialOwnershipStatuses={["wishlisted"]}
    />
  );
};

export default WishlistGamesPage;
