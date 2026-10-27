import { useState } from "react";
import { Link } from "react-router-dom";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import Divider from "@mui/material/Divider";
import { useTheme } from "@mui/material/styles";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import epicGamesLogo from "../assets/epic-games-logo.png";
import gogLogo from "../assets/gog.com-logo.png";
import igdbLogo from "../assets/igdb-logo.png";
import nintendoLogo from "../assets/nintendo-logo.png";
import playstationLogo from "../assets/playstation-logo.png";
import steamLogo from "../assets/steam-logo.png";
import xboxLogo from "../assets/xbox-logo.png";
import type { GameAboutData, GameCompany, IgdbReleaseRegion } from "../api/types";
import { useStoreRegion } from "../theme/StoreRegionProvider";
import { gameIdentifier } from "../utils/identifiers";
import { localiseStoreUrl } from "../utils/storeRegion";
import { getAddonType, getReleaseYear, isAddon } from "../utils/utils";
import ExpandableText from "./ExpandableText";
import ScreenshotGallery from "./ScreenshotGallery";
import VideoGallery from "./VideoGallery";

interface GameAboutSectionProps {
  game: GameAboutData;
  // An IGDB preview of a game that isn't in the library: its Series/Collection pages may
  // not exist locally, so those chips render as plain labels instead of links.
  preview?: boolean;
  // The public share page: Series/Collection pages are private, so those chips are plain
  // labels too, and a parent game links to its public page instead.
  publicToken?: string;
}

const GameAboutSection = ({ game, preview = false, publicToken }: GameAboutSectionProps) => {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { region: storeRegion } = useStoreRegion();
  // From i18next rather than LanguageProvider, so this section doesn't pull in i18n setup.
  const language = i18n.resolvedLanguage ?? i18n.language;
  const isAddonGame = isAddon(game);
  const linksCatalogPages = !preview && publicToken === undefined;
  const parentGameLink = (id: number, slug: string | null, uuid: string, name: string) =>
    publicToken !== undefined
      ? `/public/${publicToken}/games/${id}`
      : `/game/${gameIdentifier({ slug, uuid, name })}`;

  const companyRoleLabel: Record<string, string> = {
    developer: t("games.about.companyRoleDeveloper"),
    publisher: t("games.about.companyRolePublisher"),
    porting: t("games.about.companyRolePorting"),
    supporting: t("games.about.companyRoleSupporting"),
  };

  const releaseRegionLabel: Record<IgdbReleaseRegion, string> = {
    europe: t("games.about.regionEurope"),
    north_america: t("games.about.regionNorthAmerica"),
    australia: t("games.about.regionAustralia"),
    new_zealand: t("games.about.regionNewZealand"),
    japan: t("games.about.regionJapan"),
    china: t("games.about.regionChina"),
    asia: t("games.about.regionAsia"),
    worldwide: t("games.about.regionWorldwide"),
  };

  // IGDB status enum (0=released, 2=alpha, 3=beta, 4=early_access, 5=offline,
  // 6=cancelled, 7=rumored, 8=delisted), rendered as a chip by the title.
  const igdbStatus: Record<number, { label: string; color: "success" | "warning" | "error" | "default" }> = {
    0: { label: t("games.about.statusReleased"), color: "success" },
    2: { label: t("games.about.statusAlpha"), color: "warning" },
    3: { label: t("games.about.statusBeta"), color: "warning" },
    4: { label: t("games.about.statusEarlyAccess"), color: "warning" },
    5: { label: t("games.about.statusOffline"), color: "default" },
    6: { label: t("games.about.statusCancelled"), color: "error" },
    7: { label: t("games.about.statusRumored"), color: "default" },
    8: { label: t("games.about.statusDelisted"), color: "error" },
  };
  const statusInfo =
    game.igdbStatus !== null && game.igdbStatus !== undefined ? igdbStatus[game.igdbStatus] : undefined;

  // Age ratings render as compact badges (ESRB letter / PEGI number), IGDB's own box style.
  const esrbRating = game.ageRatings?.["ESRB"];
  const pegiRating = game.ageRatings?.["PEGI"];

  const formatHours = (seconds: number | null | undefined): string | null => {
    if (seconds === null || seconds === undefined || seconds <= 0) return null;
    const hours = seconds / 3600;
    if (hours < 1) return `${Math.round(seconds / 60)}m`;
    const rounded = Math.round(hours * 2) / 2;
    return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}h`;
  };
  const timeToBeatRows: Array<{ label: string; value: string }> = game.timeToBeat
    ? (
        [
          { label: t("games.about.timeToBeatMain"), value: formatHours(game.timeToBeat.hastily) },
          { label: t("games.about.timeToBeatExtras"), value: formatHours(game.timeToBeat.normally) },
          { label: t("games.about.timeToBeatCompletionist"), value: formatHours(game.timeToBeat.completely) },
        ] as Array<{ label: string; value: string | null }>
      ).filter((row): row is { label: string; value: string } => row.value !== null)
    : [];

  const companiesByRole = game.companies.reduce<Record<string, GameCompany[]>>((acc, company) => {
    (acc[company.role] ??= []).push(company);
    return acc;
  }, {});

  // The old "Available on" line and the per-platform release chips now live behind one
  // expandable section below Game modes, so a many-release game stops pushing the rest
  // of the page down. The section only renders when at least one of the two would have.
  const [platformsExpanded, setPlatformsExpanded] = useState(false);
  const showAvailablePlatforms = game.platforms.length > 0 || game.releaseDates.length > 1;

  const hasStoryline = game.storyline && game.storyline !== game.summary;

  return (
    <>
      <CardContent>
        {game.igdbId === null ? (
          <Tooltip title={t("games.about.customTooltip")}>
            <Chip
              label={t("games.about.customLabel")}
              size="small"
              variant="outlined"
              sx={{ mb: 1 }}
            />
          </Tooltip>
        ) : null}
        <Stack
          direction="row"
          spacing={1.5}
          sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 1 }}
        >
          <Typography variant="h4" component="h1" sx={{ lineHeight: 1.15 }}>
            {game.name}{" "}
            <Typography variant="subtitle2" color="text.secondary" component="span">
              ({getReleaseYear(game.firstReleaseDate) ?? t("common.unknown")})
            </Typography>
          </Typography>
          {game.rating !== null ? (
            <Chip
              label={t("games.about.igdbRatingLabel", { rating: Math.round(game.rating) })}
              size="small"
              variant="outlined"
              color="primary"
            />
          ) : null}
          {statusInfo ? (
            <Chip label={statusInfo.label} size="small" color={statusInfo.color} />
          ) : null}
          {esrbRating ? (
            <Tooltip title={t("games.about.ageRatingTooltip", { system: "ESRB" })}>
              <Box
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 30,
                  height: 36,
                  border: "2px solid",
                  borderColor: "text.primary",
                  borderRadius: 1,
                  fontWeight: 900,
                  fontSize: 15,
                  lineHeight: 1,
                }}
              >
                {esrbRating}
              </Box>
            </Tooltip>
          ) : null}
          {pegiRating ? (
            <Tooltip title={t("games.about.ageRatingTooltip", { system: "PEGI" })}>
              <Box
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: 30,
                  height: 36,
                  px: 0.75,
                  border: "2px solid",
                  borderColor: "text.primary",
                  borderRadius: 1,
                  fontWeight: 900,
                  fontSize: 13,
                  lineHeight: 1,
                }}
              >
                {pegiRating}+
              </Box>
            </Tooltip>
          ) : null}
        </Stack>
        {game.edition ? (
          <Typography variant="subtitle1" color="text.secondary">
            {game.edition}
          </Typography>
        ) : null}
        {isAddonGame ? (
          <Typography variant="subtitle1" color="text.secondary" component="span">
            {getAddonType(game)}
            {game.parentGameId !== null ? (
              <>
                {t("games.about.forConnector")}
                <Link
                  to={parentGameLink(
                    game.parentGameId,
                    game.parentGameSlug,
                    game.parentGameUuid!,
                    game.parentGameName!,
                  )}
                  style={{ color: theme.palette.text.primary }}
                >
                  {game.parentGameName}
                </Link>
              </>
            ) : game.displayParentGameId !== null ? (
              <>
                {t("games.about.forConnector")}
                <Link
                  to={parentGameLink(
                    game.displayParentGameId,
                    game.displayParentGameSlug,
                    game.displayParentGameUuid!,
                    game.displayParentGameName!,
                  )}
                  style={{ color: theme.palette.text.primary }}
                >
                  {game.displayParentGameName}
                </Link>
              </>
            ) : game.externalParentName ? (
              <>
                {t("games.about.forConnector")}
                {game.externalParentIgdbUrl ? (
                  <Tooltip title={t("games.about.externalParentTooltip")}>
                    <a
                      href={game.externalParentIgdbUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: theme.palette.text.primary }}
                    >
                      {game.externalParentName}
                    </a>
                  </Tooltip>
                ) : (
                  game.externalParentName
                )}
              </>
            ) : null}
          </Typography>
        ) : null}

        {Object.entries(companiesByRole).map(([role, companies]) => (
          <Stack
            key={role}
            direction="row"
            spacing={0.75}
            sx={{ alignItems: "center", flexWrap: "wrap", mt: 0.5 }}
          >
            <Typography variant="body2" color="text.secondary" component="span">
              {companyRoleLabel[role] ?? role}:
            </Typography>
            {companies.map((company, index) => (
              <Stack key={company.id} direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                <Typography variant="body2" color="text.secondary" component="span">
                  {company.name}
                  {index < companies.length - 1 ? "," : ""}
                </Typography>
              </Stack>
            ))}
          </Stack>
        ))}
        {game.genres.length > 0 || game.franchises.length > 0 || game.collections.length > 0 ? (
          <Stack direction="row" spacing={1} sx={{ mt: 1.5, flexWrap: "wrap", rowGap: 1 }}>
            {game.genres.map((genre) => (
              <Chip key={`genre-${genre.id}`} label={genre.name} size="small" variant="outlined" />
            ))}
            {game.franchises.map((franchise) => (
              <Chip
                key={`franchise-${franchise.id}`}
                label={t("games.about.seriesLabel", { name: franchise.name })}
                size="small"
                {...(linksCatalogPages
                  ? { component: Link, to: `/games/series/${franchise.slug ?? ""}`, clickable: true }
                  : {})}
              />
            ))}
            {game.collections.map((collection) => (
              <Chip
                key={`collection-${collection.id}`}
                label={t("games.about.collectionLabel", { name: collection.name })}
                size="small"
                {...(linksCatalogPages
                  ? { component: Link, to: `/games/collections/${collection.slug ?? ""}`, clickable: true }
                  : {})}
              />
            ))}
          </Stack>
        ) : null}

        {game.gameModes.length > 0 ? (
          <Stack direction="row" spacing={1} sx={{ mt: 1.5, flexWrap: "wrap", rowGap: 1, alignItems: "center" }}>
            <Typography variant="body2" color="text.secondary">
              {t("games.about.gameModesLabel")}
            </Typography>
            {game.gameModes.map((mode) => (
              <Chip key={`mode-${mode}`} label={mode} size="small" variant="outlined" />
            ))}
          </Stack>
        ) : null}

        {showAvailablePlatforms ? (
          <Box sx={{ mt: 1.5 }}>
            <ButtonBase
              onClick={() => setPlatformsExpanded((expanded) => !expanded)}
              aria-expanded={platformsExpanded}
              sx={{ display: "flex", alignItems: "center", gap: 0.5, borderRadius: 1 }}
            >
              <Typography variant="body2" color="text.secondary">
                {t("games.about.availablePlatformsTitle")}
              </Typography>
              {platformsExpanded ? (
                <ExpandLessIcon fontSize="small" color="action" />
              ) : (
                <ExpandMoreIcon fontSize="small" color="action" />
              )}
            </ButtonBase>
            <Collapse in={platformsExpanded}>
              <Stack spacing={1.5} sx={{ mt: 1 }}>
                {game.platforms.length > 0 ? (
                  <Typography variant="body2" color="text.secondary" component="div">
                    {t("games.about.availableOnLabel", {
                      platforms: game.platforms.map((platform) => platform.name).join(", "),
                    })}
                  </Typography>
                ) : null}
                {game.releaseDates.length > 1 ? (
                  <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", rowGap: 1 }}>
                    {game.releaseDates.map((releaseDate) => (
                      <Chip
                        key={releaseDate.id}
                        size="small"
                        variant="outlined"
                        label={`${releaseDate.platformName ?? t("games.about.unknownPlatform")}: ${
                          releaseDate.human ?? t("games.about.tbd")
                        }${releaseDate.releaseRegion ? ` (${releaseRegionLabel[releaseDate.releaseRegion]})` : ""}`}
                      />
                    ))}
                  </Stack>
                ) : null}
              </Stack>
            </Collapse>
          </Box>
        ) : null}
      </CardContent>
      <Divider />
      <CardContent>{game.summary ? <ExpandableText text={game.summary} /> : null}</CardContent>
      {hasStoryline ? (
        <>
          <Divider />
          <CardContent>
            <Typography variant="subtitle2" gutterBottom>
              {t("games.about.storylineTitle")}
            </Typography>
            <ExpandableText text={game.storyline as string} />
          </CardContent>
        </>
      ) : null}
      {timeToBeatRows.length > 0 ? (
        <>
          <Divider />
          <CardContent>
            <Typography variant="subtitle2" gutterBottom>
              {t("games.about.timeToBeatTitle")}
            </Typography>
            <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", rowGap: 1 }}>
              {timeToBeatRows.map((row) => (
                <Box
                  key={row.label}
                  sx={{
                    flex: "1 1 100px",
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 2,
                    px: 1.5,
                    py: 1,
                    textAlign: "center",
                  }}
                >
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                    {row.label}
                  </Typography>
                  <Typography variant="h6" sx={{ lineHeight: 1.3 }}>
                    {row.value}
                  </Typography>
                </Box>
              ))}
            </Stack>
            {game.timeToBeat?.count ? (
              <Typography variant="caption" color="text.secondary">
                {t("games.about.timeToBeatSubmissions", { count: game.timeToBeat.count })}
              </Typography>
            ) : null}
          </CardContent>
        </>
      ) : null}
      {game.screenshotUrls.length > 0 ? (
        <>
          <Divider />
          <CardContent>
            <ScreenshotGallery urls={game.screenshotUrls} altPrefix={game.name} />
          </CardContent>
        </>
      ) : null}
      {game.artworkUrls.length > 0 ? (
        <>
          <Divider />
          <CardContent>
            <ScreenshotGallery
              urls={game.artworkUrls}
              altPrefix={game.name}
              title={t("games.about.artworkTitle")}
            />
          </CardContent>
        </>
      ) : null}
      {game.videos.length > 0 ? (
        <>
          <Divider />
          <CardContent>
            <VideoGallery videos={game.videos} />
          </CardContent>
        </>
      ) : null}
      <Divider />
      <CardContent>
        <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
          {game.igdbUrl && (
            <Tooltip title={t("games.about.viewOnIgdb")}>
              <a
                href={game.igdbUrl}
                target="_blank"
                rel="noreferrer"
                style={{ color: theme.palette.text.primary }}
              >
                <img src={igdbLogo} alt={t("games.about.viewOnIgdb")} style={{ width: "64px" }} />
              </a>
            </Tooltip>
          )}
          {game.steamStoreUrl && (
            <Tooltip title={t("games.about.viewOnSteam")}>
              <a
                href={game.steamStoreUrl}
                target="_blank"
                rel="noreferrer"
                style={{ color: theme.palette.text.primary }}
              >
                <img src={steamLogo} alt={t("games.about.viewOnSteam")} style={{ width: "64px" }} />
              </a>
            </Tooltip>
          )}
          {game.xboxStoreUrl && (
            <Tooltip title={t("games.about.viewOnXbox")}>
              <a
                href={localiseStoreUrl(game.xboxStoreUrl, "xbox", storeRegion, language)}
                target="_blank"
                rel="noreferrer"
                style={{ color: theme.palette.text.primary }}
              >
                <img src={xboxLogo} alt={t("games.about.viewOnXbox")} style={{ width: "64px" }} />
              </a>
            </Tooltip>
          )}
          {game.playstationStoreUrl && (
            <Tooltip title={t("games.about.viewOnPlaystation")}>
              <a
                href={localiseStoreUrl(game.playstationStoreUrl, "playstation", storeRegion, language)}
                target="_blank"
                rel="noreferrer"
                style={{ color: theme.palette.text.primary }}
              >
                <img
                  src={playstationLogo}
                  alt={t("games.about.viewOnPlaystation")}
                  style={{ width: "64px" }}
                />
              </a>
            </Tooltip>
          )}
          {game.nintendoStoreUrl && (
            <Tooltip title={t("games.about.viewOnNintendo")}>
              <a
                href={game.nintendoStoreUrl}
                target="_blank"
                rel="noreferrer"
                style={{ color: theme.palette.text.primary }}
              >
                <img src={nintendoLogo} alt={t("games.about.viewOnNintendo")} style={{ width: "64px" }} />
              </a>
            </Tooltip>
          )}
          {game.epicGamesStoreUrl && (
            <Tooltip title={t("games.about.viewOnEpicGames")}>
              <a
                href={game.epicGamesStoreUrl}
                target="_blank"
                rel="noreferrer"
                style={{ color: theme.palette.text.primary }}
              >
                <img src={epicGamesLogo} alt={t("games.about.viewOnEpicGames")} style={{ width: "64px" }} />
              </a>
            </Tooltip>
          )}
          {game.gogStoreUrl && (
            <Tooltip title={t("games.about.viewOnGog")}>
              <a
                href={game.gogStoreUrl}
                target="_blank"
                rel="noreferrer"
                style={{ color: theme.palette.text.primary }}
              >
                <img src={gogLogo} alt={t("games.about.viewOnGog")} style={{ width: "64px" }} />
              </a>
            </Tooltip>
          )}
        </Stack>
      </CardContent>
    </>
  );
};

export default GameAboutSection;
