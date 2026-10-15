import { useState } from "react";
import { useParams } from "react-router-dom";
import SearchIcon from "@mui/icons-material/Search";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import InputAdornment from "@mui/material/InputAdornment";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useScrollDirection } from "../hooks/useScrollCollapse";
import PublicAccessoryList from "./PublicAccessoryList";
import PublicDeviceList from "./PublicDeviceList";

const PublicHardwarePage = () => {
  const { token } = useParams<{ token: string }>();
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim(), 500);
  // Hide on scroll down, reappear on scroll up.
  const hideSearchBar = useScrollDirection(80);

  return (
    <>
      <Typography variant="h4" component="h1" gutterBottom>
        {t("public.hardware.title")}
      </Typography>
      <Box sx={{ display: hideSearchBar ? "none" : "block" }}>
        <Paper sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2, mb: 3 }}>
        <TextField
          label={t("public.hardware.searchLabel")}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          fullWidth
          sx={{ maxWidth: 480 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            },
          }}
        />
        </Paper>
      </Box>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h5" component="h2" gutterBottom>
            {t("public.hardware.devicesHeading")}
          </Typography>
          <PublicDeviceList token={token} search={debouncedSearch} />
        </Box>
        <Box>
          <Typography variant="h5" component="h2" gutterBottom>
            {t("public.hardware.accessoriesHeading")}
          </Typography>
          <PublicAccessoryList token={token} search={debouncedSearch} />
        </Box>
      </Stack>
    </>
  );
};

export default PublicHardwarePage;
