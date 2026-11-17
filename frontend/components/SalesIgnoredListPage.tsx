import type { SyntheticEvent } from "react";
import AddCircleOutlineOutlinedIcon from "@mui/icons-material/AddCircleOutlineOutlined";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import RemoveCircleIcon from "@mui/icons-material/RemoveCircle";
import ReplayIcon from "@mui/icons-material/Replay";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Tab from "@mui/material/Tab";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TablePagination from "@mui/material/TablePagination";
import TableRow from "@mui/material/TableRow";
import Tabs from "@mui/material/Tabs";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import type { MediaFormat } from "../api/types";
import type { IgnoredSalesTitle, SalesProvider, TrackedSalesItem } from "../api/salesTracking";
import {
  useIgnoredSalesTitles,
  useRemoveIgnoredSalesTitle,
  useRemoveWishlistItem,
  useRetryIgnoredSalesTitle,
  useTrackSalesItem,
  useUntrackedSalesItems,
} from "../hooks/useSalesTracking";
import { useCurrency } from "../theme/CurrencyProvider";
import { formatCurrency } from "../utils/currency";
import { gameIdentifier } from "../utils/identifiers";
import { TOAST_OPTIONS } from "../utils/toastOptions";

const PROVIDER_LABEL_KEY: Record<SalesProvider, string> = {
  itad: "insights.salesIgnored.provider.itad",
  platprices: "insights.salesIgnored.provider.platprices",
  nintendo: "insights.salesIgnored.provider.nintendo",
};

const IgnoredPanel = () => {
  const { t } = useTranslation();
  const { data: items } = useIgnoredSalesTitles();
  const retryTitle = useRetryIgnoredSalesTitle();
  const removeTitle = useRemoveIgnoredSalesTitle();

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const rows = items ?? [];
  const visibleRows = rows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const handleRetry = async (provider: SalesProvider, gameId: number) => {
    try {
      await retryTitle.mutateAsync({ provider, gameId });
      toast.success(t("insights.salesIgnored.retrySuccessToast"), TOAST_OPTIONS);
    } catch (error) {
      console.error(`Error retrying ${provider} game ${gameId}:`, error);
      toast.error(t("insights.salesIgnored.retryErrorToast"), TOAST_OPTIONS);
    }
  };

  const handleRemove = async (provider: SalesProvider, gameId: number) => {
    try {
      await removeTitle.mutateAsync({ provider, gameId });
      toast.success(t("insights.salesIgnored.removeSuccessToast"), TOAST_OPTIONS);
    } catch (error) {
      console.error(`Error removing ${provider} game ${gameId}:`, error);
      toast.error(t("insights.salesIgnored.removeErrorToast"), TOAST_OPTIONS);
    }
  };

  return (
    <>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t("insights.salesIgnored.description")}
      </Typography>
      {items !== undefined ? (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t(
            rows.length === 1
              ? "catalog.refCard.gameCountSingular"
              : "catalog.refCard.gameCountPlural",
            { count: rows.length }
          )}
        </Typography>
      ) : null}

      <Paper sx={{ width: "100%", overflow: "hidden", borderRadius: 2 }}>
        {rows.length === 0 ? (
          <Box sx={{ p: 3, textAlign: "center", color: "text.secondary" }}>
            {t("insights.salesIgnored.emptyState")}
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell />
                  <TableCell>{t("insights.salesIgnored.columnName")}</TableCell>
                  <TableCell>{t("insights.salesIgnored.columnProvider")}</TableCell>
                  <TableCell>{t("insights.salesIgnored.columnCheckedAt")}</TableCell>
                  <TableCell align="right">{t("insights.salesIgnored.columnActions")}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {visibleRows.map((row: IgnoredSalesTitle) => (
                  <TableRow key={`${row.provider}-${row.gameId}`} hover>
                    <TableCell>
                      <Avatar
                        variant="rounded"
                        src={row.gameCoverUrl ?? undefined}
                        sx={{ width: 32, height: 44 }}
                      >
                        {row.gameName.charAt(0)}
                      </Avatar>
                    </TableCell>
                    <TableCell>
                      <Link to={`/game/${gameIdentifier({ slug: row.gameSlug, uuid: row.gameUuid, name: row.gameName })}`}>
                        {row.gameName}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Chip size="small" label={t(PROVIDER_LABEL_KEY[row.provider])} />
                    </TableCell>
                    <TableCell>
                      {row.checkedAt ? new Date(row.checkedAt).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title={t("insights.salesIgnored.retryButton")}>
                        <IconButton
                          size="small"
                          onClick={() => void handleRetry(row.provider, row.gameId)}
                        >
                          <ReplayIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t("insights.salesIgnored.removeButton")}>
                        <IconButton
                          size="small"
                          onClick={() => void handleRemove(row.provider, row.gameId)}
                        >
                          <RemoveCircleIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
        <TablePagination
          component="div"
          count={rows.length}
          page={page}
          onPageChange={(_event, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(event) => {
            setRowsPerPage(parseInt(event.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[10, 25, 50]}
        />
      </Paper>
    </>
  );
};

const UntrackedPanel = () => {
  const { t } = useTranslation();
  const { currency } = useCurrency();
  const { data: items } = useUntrackedSalesItems();
  const trackItem = useTrackSalesItem();
  const removeItem = useRemoveWishlistItem();

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const rows = items ?? [];
  const visibleRows = rows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const formatLabels: Record<MediaFormat, string> = {
    physical: t("games.library.formatPhysical"),
    digital: t("games.library.formatDigital"),
    iso: t("games.library.formatIso"),
    rom: t("games.library.formatRom"),
    abandonware: t("games.library.formatAbandonware"),
    subscription: t("games.library.formatSubscription"),
    other: t("games.library.formatOther"),
  };

  const handleTrack = async (libraryItemId: number) => {
    try {
      await trackItem.mutateAsync(libraryItemId);
      toast.success(t("insights.salesIgnored.trackSuccessToast"), TOAST_OPTIONS);
    } catch (error) {
      console.error(`Error tracking library item ${libraryItemId}:`, error);
      toast.error(t("insights.salesIgnored.trackErrorToast"), TOAST_OPTIONS);
    }
  };

  const handleRemove = async (libraryItemId: number) => {
    try {
      await removeItem.mutateAsync(libraryItemId);
      toast.success(t("insights.salesIgnored.removeFromWishlistSuccessToast"), TOAST_OPTIONS);
    } catch (error) {
      console.error(`Error removing library item ${libraryItemId} from wishlist:`, error);
      toast.error(t("insights.salesIgnored.removeFromWishlistErrorToast"), TOAST_OPTIONS);
    }
  };

  return (
    <>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t("insights.salesIgnored.untrackedDescription")}
      </Typography>
      {items !== undefined ? (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t(
            rows.length === 1
              ? "catalog.refCard.gameCountSingular"
              : "catalog.refCard.gameCountPlural",
            { count: rows.length }
          )}
        </Typography>
      ) : null}

      <Paper sx={{ width: "100%", overflow: "hidden", borderRadius: 2 }}>
        {rows.length === 0 ? (
          <Box sx={{ p: 3, textAlign: "center", color: "text.secondary" }}>
            {t("insights.salesIgnored.untrackedEmptyState")}
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell />
                  <TableCell>{t("insights.saleTracked.columnName")}</TableCell>
                  <TableCell>{t("insights.saleTracked.columnPlatform")}</TableCell>
                  <TableCell>{t("insights.saleTracked.columnFormat")}</TableCell>
                  <TableCell>{t("insights.saleTracked.columnStorefront")}</TableCell>
                  <TableCell>{t("insights.saleTracked.columnTargetPrice")}</TableCell>
                  <TableCell align="right">{t("insights.saleTracked.columnActions")}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {visibleRows.map((row: TrackedSalesItem) => (
                  <TableRow key={row.libraryItemId} hover>
                    <TableCell>
                      <Avatar
                        variant="rounded"
                        src={row.gameCoverUrl ?? undefined}
                        sx={{ width: 32, height: 44 }}
                      >
                        {row.gameName.charAt(0)}
                      </Avatar>
                    </TableCell>
                    <TableCell>
                      <Link to={`/game/${gameIdentifier({ slug: row.gameSlug, uuid: row.gameUuid, name: row.gameName })}`}>
                        {row.gameName}
                      </Link>
                    </TableCell>
                    <TableCell>{row.platformName ?? "-"}</TableCell>
                    <TableCell>{row.format ? formatLabels[row.format] : "-"}</TableCell>
                    <TableCell>{row.digitalStorefront ?? "-"}</TableCell>
                    <TableCell>
                      {row.targetPrice != null ? formatCurrency(row.targetPrice, currency) : "-"}
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title={t("insights.salesIgnored.trackButton")}>
                        <IconButton
                          size="small"
                          onClick={() => void handleTrack(row.libraryItemId)}
                          disabled={trackItem.isPending && trackItem.variables === row.libraryItemId}
                        >
                          <AddCircleOutlineOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t("insights.salesIgnored.removeFromWishlistButton")}>
                        <IconButton
                          size="small"
                          onClick={() => void handleRemove(row.libraryItemId)}
                          disabled={removeItem.isPending && removeItem.variables === row.libraryItemId}
                        >
                          <DeleteOutlineOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
        <TablePagination
          component="div"
          count={rows.length}
          page={page}
          onPageChange={(_event, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(event) => {
            setRowsPerPage(parseInt(event.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[10, 25, 50]}
        />
      </Paper>
    </>
  );
};

// Two tabs on the one page, same shape as the Integration Sync page: the tab lives in
// the URL (?tab=ignored|untracked) so a tab is deep-linkable and the back button steps
// between tabs. Ignored is the titles a provider gave up on; Untracked is the wishlist
// games that could be tracked but aren't yet.
const SalesIgnoredListPage = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") === "untracked" ? "untracked" : "ignored";

  const handleTabChange = (_event: SyntheticEvent, next: string) => {
    setSearchParams({ tab: next === "untracked" ? "untracked" : "ignored" });
  };

  return (
    <>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          {t("insights.salesIgnored.heading")}
        </Typography>
      </Box>
      <Tabs value={tab} onChange={handleTabChange} aria-label={t("insights.salesIgnored.heading")} sx={{ mb: 2 }}>
        <Tab value="ignored" label={t("insights.salesIgnored.tabIgnored")} />
        <Tab value="untracked" label={t("insights.salesIgnored.tabUntracked")} />
      </Tabs>
      {tab === "ignored" ? <IgnoredPanel /> : <UntrackedPanel />}
    </>
  );
};

export default SalesIgnoredListPage;
