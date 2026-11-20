// The "Owned on" block on the game page's left column: the owned platform
// chips as they always were, plus a dropdown (same pattern as the About
// section's Available Platforms). A wishlist copy adds a Wishlisted chip
// instead of a platform chip — its platform isn't owned. On the private page
// it shows when the game was added and, for each owned copy, when that copy
// was acquired; on the public pages it shows platform and format only — no
// dates, since those are the owner's private data. Collapsed, the block looks
// exactly as it did before.
import { useMemo, useState } from "react";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import FavoriteIcon from "@mui/icons-material/Favorite";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import type { LibraryItem, MediaFormat, PublicOwnedCopy } from "../api/types";
import { Pill } from "./Detail";

interface GameOwnedOnSectionProps {
  // The game's added date (Game.created_at, ISO datetime). Private pages only.
  createdAt?: string;
  libraryItems?: LibraryItem[];
  // Public pages: the owned copies from the public detail response. When given,
  // the dropdown shows platform + format only — no Date Added, no acquired dates.
  publicCopies?: PublicOwnedCopy[];
}

// One expanded row: a platform, its format, and (private pages only) when the
// copy was acquired.
interface OwnedOnRow {
  key: string | number;
  platformName: string | null;
  format: string | null;
  acquiredAt: string | null;
}

const GameOwnedOnSection = ({
  createdAt,
  libraryItems,
  publicCopies,
}: GameOwnedOnSectionProps) => {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? i18n.language;
  const [expanded, setExpanded] = useState(false);
  // Public pages pass copies instead of library items, and get no dates.
  const showDates = publicCopies === undefined;

  // Owned platforms only — a wishlist copy's platform isn't owned, so it
  // gets no chip here (it gets the Wishlisted chip below instead). Public
  // pages pass owned copies only, so the same rule holds there.
  const ownedPlatforms = useMemo(() => {
    const names = new Set<string>();
    if (publicCopies) {
      for (const copy of publicCopies) {
        if (copy.platform) names.add(copy.platform);
      }
    } else {
      for (const item of libraryItems ?? []) {
        if (item.status === "owned" && item.platformName) names.add(item.platformName);
      }
    }
    return [...names].sort();
  }, [libraryItems, publicCopies]);

  // A wishlist copy shows one Wishlisted chip alongside the owned platform
  // chips. Public pages never see wishlist copies, so this stays false there.
  const hasWishlistedCopy = useMemo(
    () => (libraryItems ?? []).some((item) => item.status === "wishlist"),
    [libraryItems]
  );

  // Only owned copies have an acquired date to show — a wishlist row would just
  // render dateless. Sorted by platform, then format, so the list is stable.
  const ownedCopies = useMemo((): OwnedOnRow[] => {
    const rows: OwnedOnRow[] = publicCopies
      ? publicCopies.map((copy, index) => ({
          key: index,
          platformName: copy.platform,
          format: copy.format,
          acquiredAt: null,
        }))
      : (libraryItems ?? [])
          .filter((item) => item.status === "owned")
          .map((item) => ({
            key: item.id,
            platformName: item.platformName,
            format: item.format,
            acquiredAt: item.acquiredAt,
          }));
    return rows.sort(
      (a, b) =>
        (a.platformName ?? "").localeCompare(b.platformName ?? "") ||
        (a.format ?? "").localeCompare(b.format ?? "")
    );
  }, [libraryItems, publicCopies]);

  if (ownedPlatforms.length === 0 && !hasWishlistedCopy) {
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
  // Public copies carry the format as a plain string; an unknown one falls back
  // to a capitalized label, like the public page's own format helper.
  const formatLabel = (format: string | null) =>
    format
      ? (formatLabels as Record<string, string>)[format] ??
        format.charAt(0).toUpperCase() + format.slice(1)
      : "";
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
        onClick={() => setExpanded((wasExpanded) => !wasExpanded)}
        aria-expanded={expanded}
        sx={{ display: "flex", alignItems: "center", gap: 0.5, borderRadius: 1 }}
      >
        <Typography variant="subtitle2" color="text.secondary">
          {t("public.games.ownedOn")}
        </Typography>
        {expanded ? (
          <ExpandLessIcon fontSize="small" color="action" />
        ) : (
          <ExpandMoreIcon fontSize="small" color="action" />
        )}
      </ButtonBase>
      {/* The chips are the collapsed view: once the dropdown is open, they swap
      out for the rows box so the section doesn't repeat the same platforms. */}
      {!expanded && (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 1, alignItems: "center" }}>
          {ownedPlatforms.map((platform) => (
            <Chip key={platform} label={platform} size="small" />
          ))}
          {hasWishlistedCopy ? (
            <Pill small tone="wishlist" icon={<FavoriteIcon />}>
              {t("games.card.wishlistedLine")}
            </Pill>
          ) : null}
        </Box>
      )}
      <Collapse in={expanded}>
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
            {showDates && (
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
                  {formatAdded(createdAt!)}
                </Box>
              </Box>
            )}
            {ownedCopies.map((item, index) => (
              <Box
                component="li"
                key={item.key}
                sx={{
                  display: "grid",
                  gridTemplateColumns: showDates ? "minmax(0, 1fr) auto" : "minmax(0, 1fr)",
                  columnGap: 1.5,
                  py: 0.75,
                  // The first row has no divider above it when there is no
                  // Date Added row ahead of it (public pages).
                  borderTop: showDates || index > 0 ? 1 : 0,
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
                  {item.format ? ` · ${formatLabel(item.format)}` : ""}
                </Box>
                {showDates && (
                  <Box sx={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                    {formatAcquired(item.acquiredAt)}
                  </Box>
                )}
              </Box>
            ))}
          </Box>
        </Box>
      </Collapse>
    </Box>
  );
};

export default GameOwnedOnSection;
