import { useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import {
  APP_ICON_CHOICES,
  DEFAULT_APP_ICON,
  DEFAULT_APP_TITLE,
  DEFAULT_ICON_SRC,
  isCustomIconDataUrl,
  useAppearance,
} from "../theme/AppearanceProvider";
import { SEED_COLOR_HEX } from "../theme/m3Colors";

const PRESET_COLORS = [
  "#7C4DFF", // default vivid purple
  "#D81B60", // pink
  "#E53935", // red
  "#FB8C00", // orange
  "#FBC02D", // yellow
  "#43A047", // green
  "#00897B", // teal
  "#039BE5", // light blue
  "#3949AB", // indigo
  "#8E24AA", // purple
  "#6D4C41", // brown
  "#546E7A", // blue grey
];

const AppearanceSection = () => {
  const { t } = useTranslation();
  const {
    accentColor,
    setAccentColor,
    appTitle,
    setAppTitle,
    appIcon,
    setAppIcon,
    hideHardwareMenu,
    setHideHardwareMenu,
    resetAppearance,
  } = useAppearance();
  const [titleDraft, setTitleDraft] = useState(appTitle);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleIconUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      return;
    }
    // Limit to 500KB to avoid bloating localStorage/server
    if (file.size > 500 * 1024) {
      alert(t("settings.appearance.iconTooLarge"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setAppIcon(dataUrl);
    };
    reader.readAsDataURL(file);
    // Reset input so same file can be selected again
    event.target.value = "";
  };

  const handleTitleBlur = () => {
    if (titleDraft !== appTitle) {
      setAppTitle(titleDraft);
      setTitleDraft(titleDraft.trim() ? titleDraft.trim() : DEFAULT_APP_TITLE);
    }
  };

  const handleTitleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") {
      (event.target as HTMLInputElement).blur();
    }
  };

  const isCustomized =
    accentColor !== SEED_COLOR_HEX ||
    appTitle !== DEFAULT_APP_TITLE ||
    appIcon !== DEFAULT_APP_ICON ||
    hideHardwareMenu;

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        {t("settings.appearance.description")}
      </Typography>

      <Typography variant="subtitle2" gutterBottom>
        {t("settings.appearance.accentColor")}
      </Typography>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 1 }}>
        {PRESET_COLORS.map((hex) => (
          <Box
            key={hex}
            role="button"
            tabIndex={0}
            aria-label={hex}
            onClick={() => setAccentColor(hex)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") setAccentColor(hex);
            }}
            sx={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              backgroundColor: hex,
              cursor: "pointer",
              border: (theme) =>
                accentColor.toLowerCase() === hex.toLowerCase()
                  ? `3px solid ${theme.palette.primary.contrastText}`
                  : "3px solid transparent",
              outline: (theme) =>
                accentColor.toLowerCase() === hex.toLowerCase()
                  ? `2px solid ${theme.palette.text.primary}`
                  : "none",
              outlineOffset: 2,
            }}
          />
        ))}
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: (theme) => `2px dashed ${theme.palette.text.secondary}`,
            fontSize: 20,
            color: "text.secondary",
            position: "relative",
            overflow: "hidden",
          }}
          title={t("settings.appearance.customColor")}
        >
          +
          <input
            type="color"
            value={accentColor}
            onChange={(e) => setAccentColor(e.target.value)}
            aria-label={t("settings.appearance.customColor")}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              opacity: 0,
              cursor: "pointer",
            }}
          />
        </Box>
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 2 }}>
        {t("settings.appearance.accentColorHelp")}
      </Typography>

      <Typography variant="subtitle2" gutterBottom>
        {t("settings.appearance.appTitle")}
      </Typography>
      <TextField
        value={titleDraft}
        onChange={(e) => setTitleDraft(e.target.value)}
        onBlur={handleTitleBlur}
        onKeyDown={handleTitleKeyDown}
        placeholder={DEFAULT_APP_TITLE}
        fullWidth
        sx={{ maxWidth: 400, mb: 2 }}
        helperText={t("settings.appearance.appTitleHelp")}
      />

      <Typography variant="subtitle2" gutterBottom>
        {t("settings.appearance.appIcon")}
      </Typography>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 1 }}>
        {APP_ICON_CHOICES.map((icon) => {
          const isSelected = appIcon === icon;
          const isDefault = icon === "default";
          return (
            <Box
              key={icon}
              role="button"
              tabIndex={0}
              aria-label={isDefault ? t("settings.appearance.defaultIcon") : icon}
              onClick={() => setAppIcon(icon)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") setAppIcon(icon);
              }}
              sx={{
                width: 44,
                height: 44,
                borderRadius: 2,
                fontSize: 28,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                backgroundColor: (theme) =>
                  theme.palette.mode === "dark" ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
                border: (theme) =>
                  isSelected
                    ? `2px solid ${theme.palette.primary.main}`
                    : "2px solid transparent",
              }}
            >
              {isDefault ? (
                <Box component="img" src={DEFAULT_ICON_SRC} alt="" sx={{ width: 32, height: 32 }} />
              ) : (
                icon
              )}
            </Box>
          );
        })}
        {/* Custom uploaded icon preview */}
        {isCustomIconDataUrl(appIcon) && (
          <Box
            role="button"
            tabIndex={0}
            aria-label={t("settings.appearance.customIcon")}
            sx={{
              width: 44,
              height: 44,
              borderRadius: 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "default",
              backgroundColor: (theme) =>
                theme.palette.mode === "dark" ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
              border: (theme) => `2px solid ${theme.palette.primary.main}`,
            }}
          >
            <Box component="img" src={appIcon} alt="" sx={{ width: 32, height: 32 }} />
          </Box>
        )}
      </Box>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleIconUpload}
        aria-label={t("settings.appearance.uploadIcon")}
      />
      <Button
        variant="outlined"
        size="small"
        onClick={() => fileInputRef.current?.click()}
        sx={{ mb: 1 }}
      >
        {t("settings.appearance.uploadIcon")}
      </Button>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 2 }}>
        {t("settings.appearance.appIconHelp")}
      </Typography>

      <Typography variant="subtitle2" gutterBottom>
        {t("settings.appearance.navigationHeading")}
      </Typography>
      <FormControlLabel
        control={
          <Switch
            checked={hideHardwareMenu}
            onChange={(event) => setHideHardwareMenu(event.target.checked)}
          />
        }
        label={t("settings.appearance.hideHardwareMenu")}
      />
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 2 }}>
        {t("settings.appearance.hideHardwareMenuHelp")}
      </Typography>

      {isCustomized && (
        <Box>
          <Button variant="outlined" onClick={resetAppearance}>
            {t("settings.appearance.reset")}
          </Button>
        </Box>
      )}
    </Box>
  );
};

export default AppearanceSection;
