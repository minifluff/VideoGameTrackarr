import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TablePagination from "@mui/material/TablePagination";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import DeleteIcon from "@mui/icons-material/Delete";
import { useTranslation } from "react-i18next";
import type { GameSummary } from "../api/types";
import { useDeleteGame, useGames } from "../hooks/useGames";
import ConfirmDialog from "./ConfirmDialog";

const RemoveGamesPage = () => {
  const { t } = useTranslation();
  const { data: games, isLoading } = useGames();
  const deleteGame = useDeleteGame();

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const [lastClickedId, setLastClickedId] = useState<number | null>(null);
  const [confirmIds, setConfirmIds] = useState<number[] | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const filtered = useMemo(() => {
    const list = games ?? [];
    const trimmed = search.trim().toLowerCase();
    if (!trimmed) return list;
    return list.filter((g) => g.name.toLowerCase().includes(trimmed));
  }, [games, search]);

  const paged = useMemo(() => {
    const start = page * rowsPerPage;
    return filtered.slice(start, start + rowsPerPage);
  }, [filtered, page, rowsPerPage]);

  const gameById = useMemo(() => new Map((games ?? []).map((g) => [g.id, g])), [games]);

  const toggleOne = (id: number, shiftKey: boolean) => {
    if (shiftKey && lastClickedId !== null) {
      const ids = filtered.map((g) => g.id);
      const a = ids.indexOf(lastClickedId);
      const b = ids.indexOf(id);
      if (a !== -1 && b !== -1) {
        const [from, to] = a < b ? [a, b] : [b, a];
        const range = ids.slice(from, to + 1);
        setSelected((prev) => {
          const next = new Set(prev);
          const allSelected = range.every((r) => next.has(r));
          if (allSelected) {
            range.forEach((r) => next.delete(r));
          } else {
            range.forEach((r) => next.add(r));
          }
          return [...next];
        });
        return;
      }
    }
    setLastClickedId(id);
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const toggleAllVisible = () => {
    const visibleIds = paged.map((g) => g.id);
    const allSelected = visibleIds.every((id) => selectedSet.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        visibleIds.forEach((id) => next.delete(id));
      } else {
        visibleIds.forEach((id) => next.add(id));
      }
      return [...next];
    });
  };

  const handleConfirmDelete = async () => {
    if (!confirmIds) return;
    for (const id of confirmIds) {
      try {
        await deleteGame.mutateAsync(id);
      } catch {
        // Continue deleting the rest even if one fails.
      }
    }
    setSelected((prev) => prev.filter((id) => !confirmIds.includes(id)));
    setConfirmIds(null);
  };

  const confirmGames = (confirmIds ?? [])
    .map((id) => gameById.get(id))
    .filter((g): g is GameSummary => g !== undefined);

  const allVisibleSelected = paged.length > 0 && paged.every((g) => selectedSet.has(g.id));
  const someVisibleSelected = paged.some((g) => selectedSet.has(g.id));

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        {t("settings.removeGames.title")}
      </Typography>
      <Box sx={{ display: "flex", gap: 2, mb: 2, flexWrap: "wrap", alignItems: "center" }}>
        <TextField
          size="small"
          label={t("settings.removeGames.searchLabel")}
          placeholder={t("settings.removeGames.searchPlaceholder")}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          sx={{ minWidth: 240 }}
        />
        <Button
          variant="contained"
          color="error"
          startIcon={<DeleteIcon />}
          disabled={selected.length === 0 || deleteGame.isPending}
          onClick={() => setConfirmIds([...selected])}
        >
          {t("settings.removeGames.deleteSelected", { count: selected.length })}
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  checked={allVisibleSelected}
                  indeterminate={!allVisibleSelected && someVisibleSelected}
                  onChange={toggleAllVisible}
                />
              </TableCell>
              <TableCell>{t("settings.removeGames.columnGame")}</TableCell>
              <TableCell align="right">{t("settings.removeGames.columnActions")}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={3} align="center">
                  {t("common.loading")}
                </TableCell>
              </TableRow>
            ) : paged.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} align="center">
                  {t("settings.removeGames.noGames")}
                </TableCell>
              </TableRow>
            ) : (
              paged.map((game) => (
                <TableRow key={game.id} hover selected={selectedSet.has(game.id)}>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selectedSet.has(game.id)}
                      onClick={(e) => toggleOne(game.id, e.shiftKey)}
                      onChange={() => {}}
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                      <Avatar
                        variant="rounded"
                        src={game.coverUrl ?? undefined}
                        sx={{ width: 32, height: 44 }}
                      >
                        {game.name.charAt(0)}
                      </Avatar>
                      {game.slug ? (
                        <Link to={`/game/${game.slug}`}>{game.name}</Link>
                      ) : (
                        game.name
                      )}
                    </Box>
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      color="error"
                      startIcon={<DeleteIcon />}
                      onClick={() => setConfirmIds([game.id])}
                    >
                      {t("settings.removeGames.deleteButton")}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={filtered.length}
          page={page}
          rowsPerPage={rowsPerPage}
          onPageChange={(_, p) => setPage(p)}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[10, 25, 50, 100]}
        />
      </TableContainer>

      <ConfirmDialog
        open={confirmIds !== null}
        title={
          confirmIds && confirmIds.length === 1
            ? t("settings.removeGames.confirmSingleTitle", {
                name: gameById.get(confirmIds[0])?.name ?? "",
              })
            : t("settings.removeGames.confirmBulkTitle", { count: confirmIds?.length ?? 0 })
        }
        description={
          <Box>
            <Typography variant="body2" sx={{ mb: 1 }}>
              {t("settings.removeGames.confirmDescription")}
            </Typography>
            {confirmGames.length > 0 && confirmGames.length <= 10 && (
              <Box component="ul" sx={{ pl: 2, mb: 0 }}>
                {confirmGames.map((g) => (
                  <li key={g.id}>
                    <Typography variant="body2">{g.name}</Typography>
                  </li>
                ))}
              </Box>
            )}
          </Box>
        }
        confirmLabel={t("settings.removeGames.confirmButton")}
        confirmDisabled={deleteGame.isPending}
        onClose={() => setConfirmIds(null)}
        onConfirm={() => void handleConfirmDelete()}
      />
    </Box>
  );
};

export default RemoveGamesPage;
