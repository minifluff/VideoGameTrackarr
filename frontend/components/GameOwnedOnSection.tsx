// The "Owned on" block on the game page's left column: the platform chips as they
// always were, plus a dropdown (same pattern as the About section's Available
// Platforms) that shows when the game was added and, for each owned copy, when
// that copy was acquired. Collapsed, the block looks exactly as it did before.
import { useMemo, useState } from "react";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import type { LibraryItem, MediaFormat } from "../api/types";

interface GameOwnedOnSectionProps {
  // The game's added date (Game.created_at, ISO datetime).
  createdAt: string;
  libraryItems: LibraryItem[] | undefined;
}

const GameOwnedOnSection = ({ createdAt, libraryItems }: GameOwnedOnSectionProps) => {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? i18n.language;
  const [datesExpanded, setDatesExpanded] = useState(false);

  // Owned platforms derived from the user's library items (matches the public
  // game page's "Owned on" chips).
  const ownedPlatforms = useMemo(() => {
    const names = new Set<string>();
    for (const item of libraryItems ?? []) {
      if (item.platformName) names.add(item.platformName);
    }
    return [...names].sort();
  }, [libraryItems]);

  // Only owned copies have an acquired date to show — a wishlist row would just
  // render dateless. Sorted by platform, then format, so the list is stable.
  const ownedCopies = useMemo(
    () =>
      (libraryItems ?? [])
        .filter((item) => item.status === "owned")
        .sort(
          (a, b) =>
            (a.platformName ?? "").localeCompare(b.platformName ?? "") ||
            (a.format ?? "").localeCompare(b.format ?? "")
        ),
    [libraryItems]
  );

  if (ownedPlatforms.length === 0) {
    return null;
  }

  const formatLabels: Record<MediaFormat, string> = {
    physical: t("games.library.formatPhysical"),
    digital: t("games.library.formatDigital"),
    iso: t("games.library.formatIso"),
    rom: t("games.library.formatRom"),
    abandonware: t("games.library.formatAbandonware"),
    subscription: t("games.library.formatSubscription"),
    other: t("games.library.formatOther"),
  };
  // Date Added is a UTC timestamp — the UTC calendar date, like the release dates.
  const formatAdded = (iso: string) =>
    new Date(iso).toLocaleDateString(language, {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  // Acquired dates are date-only values, parsed at local midnight like the
  // progress section's dates so they never shift a day.
  const formatAcquired = (date: string | null) =>
    date
      ? new Date(`${date}T00:00:00`).toLocaleDateString(language, {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "";

  return (
    <Box>
      <ButtonBase
        onClick={() => setDatesExpanded((expanded) => !expanded)}
        aria-expanded={datesExpanded}
        sx={{ display: "flex", alignItems: "center", gap: 0.5, borderRadius: 1 }}
      >
        <Typography variant="subtitle2" color="text.secondary">
          {t("public.games.ownedOn")}
        </Typography>
        {datesExpanded ? (
          <ExpandLessIcon fontSize="small" color="action" />
        ) : (
          <ExpandMoreIcon fontSize="small" color="action" />
        )}
      </ButtonBase>
      {/* The chips are the collapsed view: once the dates are open, they swap
      out for the dates box so the section doesn't repeat the same platforms. */}
      {!datesExpanded && (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 1 }}>
          {ownedPlatforms.map((platform) => (
            <Chip key={platform} label={platform} size="small" />
          ))}
        </Box>
      )}
      <Collapse in={datesExpanded}>
        {/* Same bordered row box as the About section's Platforms & release dates. */}
        <Box
          sx={{
            mt: 1,
            bgcolor: "background.paper",
            border: 1,
            borderColor: "divider",
            borderRadius: 2,
            px: 1.75,
            py: 1.5,
            minWidth: 0,
          }}
        >
          <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0 }}>
            <Box
              component="li"
              sx={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) auto",
                columnGap: 1.5,
                py: 0.75,
                fontSize: 13.5,
              }}
            >
              <Box>{t("games.about.dateAddedLabel")}</Box>
              <Box sx={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                {formatAdded(createdAt)}
              </Box>
            </Box>
            {ownedCopies.map((item) => (
              <Box
                component="li"
                key={item.id}
                sx={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr) auto",
                  columnGap: 1.5,
                  py: 0.75,
                  borderTop: 1,
                  borderColor: "divider",
                  fontSize: 13.5,
                }}
              >
                <Box
                  sx={{
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.platformName ?? t("games.about.unknownPlatform")}
                  {item.format ? ` · ${formatLabels[item.format]}` : ""}
                </Box>
                <Box sx={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                  {formatAcquired(item.acquiredAt)}
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      </Collapse>
    </Box>
  );
};

export default GameOwnedOnSection;
