import { useState } from "react";
import SearchIcon from "@mui/icons-material/Search";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Grid from "@mui/material/Grid";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { getImageSearchStatus, searchImages, type ImageSearchResult } from "../api/images";
import { useDebouncedValue } from "../hooks/useDebouncedValue";

interface CoverSearchDialogProps {
  open: boolean;
  initialQuery: string;
  onSelect: (imageUrl: string) => void;
  onClose: () => void;
}

const CoverSearchDialog = ({ open, initialQuery, onSelect, onClose }: CoverSearchDialogProps) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState(initialQuery);
  const debouncedQuery = useDebouncedValue(query, 500);

  const { data: status } = useQuery({
    queryKey: ["images", "status"],
    queryFn: getImageSearchStatus,
    enabled: open,
  });

  const {
    data: results,
    isFetching,
    error,
  } = useQuery({
    queryKey: ["images", "search", debouncedQuery],
    queryFn: () => searchImages(debouncedQuery),
    enabled: open && !!status?.configured && debouncedQuery.trim().length >= 3,
  });

  const handleSelect = (result: ImageSearchResult) => {
    onSelect(result.url);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{t("games.gameForm.coverSearchTitle")}</DialogTitle>
      <DialogContent>
        {status && !status.configured ? (
          <Alert severity="warning" sx={{ mt: 1 }}>
            {t("games.gameForm.coverSearchNotConfigured")}
          </Alert>
        ) : (
          <>
            <TextField
              fullWidth
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("games.gameForm.coverSearchPlaceholder")}
              slotProps={{
                input: {
                  startAdornment: <SearchIcon sx={{ mr: 1, color: "text.secondary" }} />,
                },
              }}
              sx={{ mt: 1, mb: 2 }}
            />
            {isFetching ? (
              <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
                <CircularProgress />
              </Box>
            ) : error ? (
              <Alert severity="error">{t("games.gameForm.coverSearchError")}</Alert>
            ) : results && results.length > 0 ? (
              <Grid container spacing={1.5}>
                {results.map((result, idx) => (
                  <Grid key={idx} size={{ xs: 4, sm: 3 }}>
                    <Box
                      component="img"
                      src={result.thumbnail}
                      alt={result.title}
                      title={result.title}
                      onClick={() => handleSelect(result)}
                      sx={{
                        width: "100%",
                        height: 140,
                        objectFit: "cover",
                        borderRadius: 1,
                        cursor: "pointer",
                        border: "2px solid transparent",
                        "&:hover": { borderColor: "primary.main" },
                      }}
                    />
                  </Grid>
                ))}
              </Grid>
            ) : debouncedQuery.trim().length >= 3 ? (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", p: 3 }}>
                {t("games.gameForm.coverSearchNoResults")}
              </Typography>
            ) : null}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
      </DialogActions>
    </Dialog>
  );
};

export default CoverSearchDialog;
