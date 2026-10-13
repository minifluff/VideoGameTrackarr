import { Link } from "react-router-dom";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { useUnlinkedGames } from "../hooks/useIGDBAutolink";
import InsightsSubNav from "./InsightsSubNav";

const UnlinkedGamesPage = () => {
  const { t } = useTranslation();
  const { data: games, isLoading } = useUnlinkedGames();

  return (
    <>
      <InsightsSubNav />
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          {t("nav.unlinkedGames")}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t("insights.unlinkedGames.description")}
        </Typography>
      </Box>
      {isLoading ? (
        <Typography color="text.secondary">{t("common.loading")}</Typography>
      ) : !games || games.length === 0 ? (
        <Typography color="text.secondary">{t("insights.unlinkedGames.emptyState")}</Typography>
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t("insights.unlinkedGames.columnName")}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {games.map((game) => (
                <TableRow key={game.id} hover>
                  <TableCell>
                    <Link to={`/game/${game.id}`}>{game.name}</Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </>
  );
};

export default UnlinkedGamesPage;
