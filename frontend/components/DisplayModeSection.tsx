import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import FormControlLabel from "@mui/material/FormControlLabel";
import Slider from "@mui/material/Slider";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { fetchDisplayModeSettings, updateDisplayModeSettings } from "../api/displayMode";

const DisplayModeSection = () => {
  const { t } = useTranslation();
  const [intervalSeconds, setIntervalSeconds] = useState(10);
  const [showTitle, setShowTitle] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchDisplayModeSettings()
      .then((settings) => {
        if (cancelled) return;
        setIntervalSeconds(settings.slideIntervalSeconds);
        setShowTitle(settings.showTitle);
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const save = async (patch: { slideIntervalSeconds?: number; showTitle?: boolean }) => {
    try {
      const updated = await updateDisplayModeSettings(patch);
      setIntervalSeconds(updated.slideIntervalSeconds);
      setShowTitle(updated.showTitle);
    } catch {
      // Keep the optimistic local value; the next load re-reads the server value.
    }
  };

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t("settings.displayMode.description")}
      </Typography>
      <Typography gutterBottom>
        {t("settings.displayMode.slideInterval", { seconds: intervalSeconds })}
      </Typography>
      <Slider
        value={intervalSeconds}
        min={3}
        max={120}
        step={1}
        disabled={!loaded}
        onChange={(_, value) => setIntervalSeconds(value as number)}
        onChangeCommitted={(_, value) => void save({ slideIntervalSeconds: value as number })}
        valueLabelDisplay="auto"
        valueLabelFormat={(value) => t("settings.displayMode.seconds", { count: value })}
        sx={{ maxWidth: 400 }}
      />
      <FormControlLabel
        control={
          <Switch
            checked={showTitle}
            disabled={!loaded}
            onChange={(event) => {
              setShowTitle(event.target.checked);
              void save({ showTitle: event.target.checked });
            }}
          />
        }
        label={t("settings.displayMode.showTitle")}
        sx={{ display: "block", mt: 1 }}
      />
    </Box>
  );
};

export default DisplayModeSection;
