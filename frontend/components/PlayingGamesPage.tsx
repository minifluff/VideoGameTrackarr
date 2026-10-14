import { useTranslation } from "react-i18next";
import GameList from "./GameList";
import GamesSubNav from "./GamesSubNav";

const PlayingGamesPage = () => {
  const { t } = useTranslation();

  return (
    <>
      <GamesSubNav />
      <GameList
        sessionPrefix="games-playing"
        forcedFilters={{ playStatuses: ["playing"] }}
        subNav={<></>}
      />
    </>
  );
};

export default PlayingGamesPage;
