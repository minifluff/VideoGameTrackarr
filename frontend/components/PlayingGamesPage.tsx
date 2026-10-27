import GameList from "./GameList";

const PlayingGamesPage = () => {
  return (
    <GameList
      sessionPrefix="games-playing"
      forcedFilters={{ playStatuses: ["playing"] }}
    />
  );
};

export default PlayingGamesPage;
