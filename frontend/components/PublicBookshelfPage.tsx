import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import AlbumIcon from "@mui/icons-material/Album";
import CheckIcon from "@mui/icons-material/Check";
import SportsEsportsIcon from "@mui/icons-material/SportsEsports";
import TuneIcon from "@mui/icons-material/Tune";
import Badge from "@mui/material/Badge";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Slider from "@mui/material/Slider";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { fetchPublicBookshelf } from "../api/public";
import type { PlatformResponse } from "../api/types";
import {
  BOOKSHELF_CASE_SCALE_KEY,
  BOOKSHELF_MIXED_KEY,
  buildCaseFormatsFromEntries,
  buildShelvesFromEntries,
  buildTemplateCaseSizes,
  buildVisibleShelves,
  indexPlatformsByLabel,
  platformFilterLabel,
  readStoredCaseScale,
  readStoredMixed,
  resolvePlatformCaseSizes,
  TEMPLATE_TARGET_HEIGHT,
} from "./BookshelfPage";
import BookshelfGrid, { packRows, useProgressiveRows, useShelfWidth, useTemplateInfo } from "./BookshelfGrid";

// The share-link Bookshelf: same shelf as the private page (shared grid,
// builders, and sizing), fed by the public endpoint — hidden games never
// appear, bookends are plain dividers, and a case opens the public game page.
const PublicBookshelfPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { token } = useParams<{ token: string }>();
  const { data, isLoading } = useQuery({
    queryKey: ["public-bookshelf", token],
    queryFn: () => fetchPublicBookshelf(token!),
    enabled: Boolean(token),
    staleTime: 5 * 60 * 1000,
  });
  const [search, setSearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [formatFilter, setFormatFilter] = useState("all");
  const [caseScale, setCaseScaleState] = useState<number>(readStoredCaseScale);
  const [mixed, setMixedState] = useState<boolean>(readStoredMixed);
  const [optionsMenuAnchor, setOptionsMenuAnchor] = useState<HTMLElement | null>(null);
  const [platformMenuAnchor, setPlatformMenuAnchor] = useState<HTMLElement | null>(null);
  const [formatMenuAnchor, setFormatMenuAnchor] = useState<HTMLElement | null>(null);

  const setCaseScale = (scale: number) => {
    const clamped = Math.max(0.5, Math.min(2.0, scale));
    setCaseScaleState(clamped);
    localStorage.setItem(BOOKSHELF_CASE_SCALE_KEY, String(clamped));
  };

  const setMixed = (next: boolean) => {
    setMixedState(next);
    localStorage.setItem(BOOKSHELF_MIXED_KEY, String(next));
  };

  const entries = data?.entries;
  // The public payload's platform records carry only display fields; widen
  // them to the catalogue shape the shelf helpers read.
  const platforms = useMemo<PlatformResponse[]>(
    () =>
      (data?.platforms ?? []).map((platform) => ({
        id: 0,
        igdbId: null,
        name: platform.name,
        slug: null,
        abbreviation: platform.abbreviation,
        spineTemplateUrl: platform.spineTemplateUrl,
        caseHeightMm: platform.caseHeightMm,
        caseSpineMm: platform.caseSpineMm,
        spineColor: platform.spineColor,
        spineIcon: platform.spineIcon,
        spineIconUrl: platform.spineIconUrl,
        gameCount: 0,
      })),
    [data]
  );
  const caseFormats = useMemo(() => buildCaseFormatsFromEntries(entries), [entries]);
  const platformsByLabel = useMemo(() => indexPlatformsByLabel(platforms), [platforms]);
  const templateInfo = useTemplateInfo(platforms);
  const formatOptions = useMemo(
    () => [...new Set([...caseFormats.values()].flatMap((set) => [...set]))].sort(),
    [caseFormats]
  );

  const shelves = useMemo(() => buildShelvesFromEntries(entries), [entries]);
  const totalCases = shelves.reduce((sum, shelf) => sum + shelf.cases.length, 0);
  const keyword = search.trim().toLowerCase();
  const templateCaseSizes = useMemo(
    () => buildTemplateCaseSizes(templateInfo, TEMPLATE_TARGET_HEIGHT, new Set(shelves.map((s) => s.platform))),
    [templateInfo, shelves]
  );
  const platformCaseSizes = useMemo(
    () =>
      resolvePlatformCaseSizes(
        shelves.map((s) => s.platform),
        platformsByLabel,
        templateCaseSizes
      ),
    [shelves, platformsByLabel, templateCaseSizes]
  );
  const visibleShelves = useMemo(
    () =>
      buildVisibleShelves(shelves, {
        keyword,
        platformFilter,
        formatFilter,
        caseFormats,
        sortField: "name",
        sortDirection: "asc",
        mixed,
      }),
    [shelves, keyword, platformFilter, formatFilter, caseFormats, mixed]
  );



  // Same late-mount width measurement as the private shelf (see
  // useShelfWidth in BookshelfGrid).
  const { shelfRef, shelfWidth } = useShelfWidth();
  const rows = useMemo(
    () =>
      packRows(visibleShelves, Math.max(shelfWidth - 16, 200), platformCaseSizes, {
        mixed,
        caseScale,
      }),
    [visibleShelves, shelfWidth, platformCaseSizes, mixed, caseScale]
  );

  // Same progressive rendering as the private shelf (shared hook).
  const { visibleRows, sentinelRef, hasMore } = useProgressiveRows(rows, visibleShelves);

  return (
    <Box>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ alignItems: { sm: "center" }, justifyContent: "space-between", mb: 1 }}
      >
        <Box>
          <Typography variant="h4" component="h1">
            {t("games.bookshelf.title")}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t("games.bookshelf.summary", { cases: totalCases })}
          </Typography>
        </Box>
        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: "center", width: "100%", flex: { sm: 1 }, maxWidth: { sm: 620 } }}
        >
          <TextField
            size="small"
            fullWidth
            placeholder={t("games.bookshelf.searchPlaceholder")}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <Tooltip title={t("games.listToolbar.optionsButton")}>
            <IconButton
              onClick={(event) => setOptionsMenuAnchor(event.currentTarget)}
              aria-label={t("games.listToolbar.optionsButton")}
              aria-haspopup="menu"
              aria-expanded={optionsMenuAnchor !== null}
              sx={{ alignSelf: "center" }}
            >
              <TuneIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title={t("games.listPage.platformColumn")}>
            <IconButton
              onClick={(event) => setPlatformMenuAnchor(event.currentTarget)}
              aria-label={t("games.listPage.platformColumn")}
              aria-haspopup="menu"
              aria-expanded={platformMenuAnchor !== null}
              sx={{ alignSelf: "center" }}
            >
              <Badge badgeContent={platformFilter !== "all" ? 1 : 0} color="primary">
                <SportsEsportsIcon />
              </Badge>
            </IconButton>
          </Tooltip>
          <Tooltip title={t("games.listPage.formatColumn")}>
            <IconButton
              onClick={(event) => setFormatMenuAnchor(event.currentTarget)}
              aria-label={t("games.listPage.formatColumn")}
              aria-haspopup="menu"
              aria-expanded={formatMenuAnchor !== null}
              sx={{ alignSelf: "center" }}
            >
              <Badge badgeContent={formatFilter !== "all" ? 1 : 0} color="primary">
                <AlbumIcon />
              </Badge>
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>
      <Menu
        anchorEl={optionsMenuAnchor}
        open={optionsMenuAnchor !== null}
        onClose={() => setOptionsMenuAnchor(null)}
      >
        <Box sx={{ px: 2, py: 1.5, width: 240 }}>
          <Typography variant="subtitle2" gutterBottom>
            {t("games.bookshelf.caseSize.label")}
          </Typography>
          <Box sx={{ px: 1 }}>
            <Slider
              value={caseScale}
              onChange={(_event, value) => setCaseScale(value as number)}
              min={0.5}
              max={2.0}
              step={0.1}
              marks={[
                { value: 0.5, label: t("settings.appearance.cardSizeSmall") },
                { value: 1.0, label: t("settings.appearance.cardSizeMedium") },
                { value: 2.0, label: t("settings.appearance.cardSizeLarge") },
              ]}
              valueLabelDisplay="auto"
              valueLabelFormat={(value) => `${Math.round(value * 100)}%`}
              aria-label={t("games.bookshelf.caseSize.label")}
            />
          </Box>
          <Typography variant="caption" color="text.secondary">
            {t("games.listToolbar.cardSizePageNote")}
          </Typography>
          <Divider sx={{ my: 1.5 }} />
          <FormControlLabel
            control={
              <Switch checked={mixed} onChange={(event) => setMixed(event.target.checked)} />
            }
            label={t("games.bookshelf.mixed")}
          />
          <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
            {t("games.bookshelf.mixedHelp")}
          </Typography>
        </Box>
      </Menu>
      <Menu
        anchorEl={platformMenuAnchor}
        open={platformMenuAnchor !== null}
        onClose={() => setPlatformMenuAnchor(null)}
      >
        <MenuItem
          selected={platformFilter === "all"}
          onClick={() => {
            setPlatformFilter("all");
            setPlatformMenuAnchor(null);
          }}
        >
          <ListItemText>{t("common.all")}</ListItemText>
          {platformFilter === "all" ? (
            <CheckIcon fontSize="small" color="primary" sx={{ ml: 2 }} />
          ) : null}
        </MenuItem>
        {shelves.map((shelf) => {
          const selected = shelf.platform === platformFilter;
          return (
            <MenuItem
              key={shelf.platform}
              selected={selected}
              onClick={() => {
                setPlatformFilter(shelf.platform);
                setPlatformMenuAnchor(null);
              }}
            >
              <ListItemText>{platformFilterLabel(platformsByLabel, shelf.platform)}</ListItemText>
              {selected ? <CheckIcon fontSize="small" color="primary" sx={{ ml: 2 }} /> : null}
            </MenuItem>
          );
        })}
      </Menu>
      <Menu
        anchorEl={formatMenuAnchor}
        open={formatMenuAnchor !== null}
        onClose={() => setFormatMenuAnchor(null)}
      >
        <MenuItem
          selected={formatFilter === "all"}
          onClick={() => {
            setFormatFilter("all");
            setFormatMenuAnchor(null);
          }}
        >
          <ListItemText>{t("common.all")}</ListItemText>
          {formatFilter === "all" ? (
            <CheckIcon fontSize="small" color="primary" sx={{ ml: 2 }} />
          ) : null}
        </MenuItem>
        {formatOptions.map((format) => {
          const selected = format === formatFilter;
          return (
            <MenuItem
              key={format}
              selected={selected}
              onClick={() => {
                setFormatFilter(format);
                setFormatMenuAnchor(null);
              }}
            >
              <ListItemText>{format}</ListItemText>
              {selected ? <CheckIcon fontSize="small" color="primary" sx={{ ml: 2 }} /> : null}
            </MenuItem>
          );
        })}
      </Menu>
      {isLoading ? (
        <Paper sx={{ p: 3, textAlign: "center" }}>{t("common.loading")}</Paper>
      ) : rows.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: "center" }}>{t("games.bookshelf.empty")}</Paper>
      ) : (
        <Box ref={shelfRef}>
          <BookshelfGrid
            rows={visibleRows}
            platformsByLabel={platformsByLabel}
            templateInfo={templateInfo}
            onCaseClick={(game) => navigate(`/public/${token}/games/${game.id}`)}
            sentinelRef={sentinelRef}
            hasMore={hasMore}
          />
        </Box>
      )}
    </Box>
  );
};

export default PublicBookshelfPage;
