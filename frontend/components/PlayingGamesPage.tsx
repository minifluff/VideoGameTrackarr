import { useTranslation } from "react-i18next";
import GameList from "./GameList";

const PlayingGamesPage = () => {
  const { t } = useTranslation();
  return (
    <GameList
      sessionPrefix="games-playing"
      forcedFilters={{ playStatuses: ["playing"] }}
      title={t("nav.playing")}
    />
  );
};

export default PlayingGamesPage;
