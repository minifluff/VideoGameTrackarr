import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Collapse from "@mui/material/Collapse";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import IconButton from "@mui/material/IconButton";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { Trans, useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import igdbLogo from "../assets/igdb-logo.png";
import itadLogo from "../assets/isthereanydeal-logo.png";
import platpricesLogo from "../assets/platprices-logo.png";
import steamLogo from "../assets/steam-logo.png";
import {
  useConnectGog,
  useDisconnectGog,
  useGogStatus,
  useIntegrationsStatus,
  useUpdateSteamId,
} from "../hooks/useIntegrations";
import {
  useRetroAchievementsStatus,
  useUpdateRetroAchievementsSettings,
} from "../hooks/useAchievements";
import { useClearPlayniteCache, usePlayniteConfig, useTestPlayniteConnection, useUpdatePlayniteConfig } from "../hooks/usePlaynite";
import { TOAST_OPTIONS } from "../utils/toastOptions";

type IntegrationSectionId =
  | "igdb"
  | "steam"
  | "gog"
  | "playnite"
  | "retroachievements"
  | "itad"
  | "platprices"
  | "nintendo";

// One collapsible section on the Integrations page: the header row (logo, title,
// chips, sync buttons) always stays visible and only the body collapses, so a
// section's status and its sync button are reachable without expanding it. The
// arrow sits at the far right of the header, after any sync buttons. The body
// stays mounted while collapsed (no unmountOnExit) so half-typed fields keep
// their values when a section is folded away and reopened.
const IntegrationSection = ({
  open,
  onToggle,
  header,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  header: ReactNode;
  children: ReactNode;
}) => {
  const { t } = useTranslation();
  return (
    <>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", mb: open ? 1.5 : 0 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexGrow: 1, minWidth: 0 }}>
          {header}
        </Box>
        <IconButton
          size="small"
          onClick={onToggle}
          aria-expanded={open}
          aria-label={open ? t("common.collapse") : t("common.expand")}
        >
          {open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </Stack>
      <Collapse in={open}>{children}</Collapse>
    </>
  );
};

const PlayniteSection = ({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: config } = usePlayniteConfig();
  const updateConfig = useUpdatePlayniteConfig();
  const testConnection = useTestPlayniteConnection();
  const [smbPath, setSmbPath] = useState("");
  const [smbUsername, setSmbUsername] = useState("");
  const [smbPassword, setSmbPassword] = useState("");
  const [touched, setTouched] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    if (!touched && config) {
      setSmbPath(config.smbPath ?? "");
      setSmbUsername(config.smbUsername ?? "");
    }
  }, [config, touched]);

  const handleTest = async () => {
    setTestResult(null);
    try {
      const result = await testConnection.mutateAsync({
        smbPath: smbPath.trim() === "" ? null : smbPath.trim(),
        smbUsername: smbUsername.trim() === "" ? null : smbUsername.trim(),
        smbPassword: smbPassword === "" ? null : smbPassword,
      });
      setTestResult(result);
    } catch {
      setTestResult({ ok: false, message: t("settings.integrations.playniteTestError") });
    }
  };

  const handleSave = async () => {
    try {
      await updateConfig.mutateAsync({
        smbPath: smbPath.trim() === "" ? null : smbPath.trim(),
        smbUsername: smbUsername.trim() === "" ? null : smbUsername.trim(),
        smbPassword: smbPassword === "" ? null : smbPassword,
      });
      setSmbPassword("");
      setTouched(false);
      toast.success(t("settings.integrations.playniteSaved"), TOAST_OPTIONS);
    } catch {
      toast.error(t("settings.integrations.playniteSaveError"), TOAST_OPTIONS);
    }
  };

  const configured = !!config?.smbPath;

  return (
    <IntegrationSection
      open={open}
      onToggle={onToggle}
      header={
        <>
          <Typography variant="subtitle1">{t("settings.integrations.playniteHeading")}</Typography>
          <ConfiguredChip configured={configured} />
          <Box sx={{ flexGrow: 1 }} />
          <Button variant="outlined" onClick={() => navigate("/settings/playnite-sync")}>
            {t("nav.playniteSync")}
          </Button>
        </>
      }
    >
      <Alert severity="info" sx={{ mb: 2 }}>
        {t("settings.integrations.playniteDescription")}
      </Alert>
      <Stack spacing={2} sx={{ maxWidth: 500 }}>
        <TextField
          label={t("settings.integrations.playnitePathLabel")}
          placeholder={t("settings.integrations.playnitePathPlaceholder")}
          value={smbPath}
          onChange={(e) => {
            setSmbPath(e.target.value);
            setTouched(true);
          }}
          helperText={t("settings.integrations.playnitePathHelper")}
          fullWidth
        />
        <TextField
          label={t("settings.integrations.playniteUsernameLabel")}
          value={smbUsername}
          onChange={(e) => {
            setSmbUsername(e.target.value);
            setTouched(true);
          }}
          helperText={t("settings.integrations.playniteUsernameHelper")}
          fullWidth
        />
        <TextField
          label={t("settings.integrations.playnitePasswordLabel")}
          type="password"
          value={smbPassword}
          onChange={(e) => {
            setSmbPassword(e.target.value);
            setTouched(true);
          }}
          helperText={
            config?.hasPassword
              ? t("settings.integrations.playnitePasswordSet")
              : t("settings.integrations.playnitePasswordHelper")
          }
          fullWidth
        />
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button variant="contained" onClick={handleSave} disabled={updateConfig.isPending}>
            {t("common.save")}
          </Button>
          <Button
            variant="outlined"
            onClick={handleTest}
            disabled={testConnection.isPending || smbPath.trim() === ""}
          >
            {t("settings.integrations.playniteTestButton")}
          </Button>
        </Box>
        {testResult && (
          <Alert severity={testResult.ok ? "success" : "error"} sx={{ mt: 1 }}>
            {testResult.message}
          </Alert>
        )}
      </Stack>
      <ClearPlayniteCacheSection />
    </IntegrationSection>
  );
};

const ClearPlayniteCacheSection = () => {
  const { t } = useTranslation();
  const clearCache = useClearPlayniteCache();
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleClear = () => {
    clearCache.mutate(undefined, {
      onSuccess: (result) => {
        setDialogOpen(false);
        toast.success(
          t("settings.integrations.playniteClearCacheSuccess", { cleared: result.cleared }),
          TOAST_OPTIONS
        );
      },
      onError: () => {
        setDialogOpen(false);
        toast.error(t("settings.integrations.playniteClearCacheError"), TOAST_OPTIONS);
      },
    });
  };

  return (
    <>
      <Divider sx={{ my: 3 }} />
      <Typography variant="subtitle1" sx={{ mb: 1 }}>
        {t("settings.integrations.playniteCacheHeading")}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t("settings.integrations.playniteCacheDescription")}
      </Typography>
      <Button
        variant="outlined"
        color="warning"
        onClick={() => setDialogOpen(true)}
        disabled={clearCache.isPending}
      >
        {t("settings.integrations.playniteClearCacheButton")}
      </Button>
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
        <DialogTitle>{t("settings.integrations.playniteClearCacheDialogTitle")}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t("settings.integrations.playniteClearCacheDialogMessage")}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>{t("common.cancel")}</Button>
          <Button onClick={handleClear} color="warning" variant="contained" disabled={clearCache.isPending}>
            {clearCache.isPending
              ? t("settings.integrations.playniteClearingCache")
              : t("settings.integrations.playniteClearCacheConfirm")}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

// RetroAchievements powers the Achievements page: the username picks whose profile
// is shown, the Web API key authorizes the calls. The key is never sent back to the
// browser — an empty field keeps the saved one (same pattern as the Playnite password).
const RetroAchievementsSection = ({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) => {
  const { t } = useTranslation();
  const { data: status } = useRetroAchievementsStatus();
  const updateSettings = useUpdateRetroAchievementsSettings();
  const [username, setUsername] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!touched) setUsername(status?.username ?? "");
  }, [status?.username, touched]);

  const usernameChanged = username.trim() !== (status?.username ?? "");
  const apiKeyChanged = apiKey.trim() !== "";
  const handleSave = async () => {
    try {
      await updateSettings.mutateAsync({
        username: username.trim() === "" ? null : username.trim(),
        // Undefined keeps the saved key; "" would clear it.
        apiKey: apiKeyChanged ? apiKey.trim() : undefined,
      });
      setApiKey("");
      setTouched(false);
      toast.success(t("settings.integrations.retroachievementsSaved"), TOAST_OPTIONS);
    } catch (error) {
      console.error("Error saving RetroAchievements settings:", error);
      toast.error(t("settings.integrations.retroachievementsSaveError"), TOAST_OPTIONS);
    }
  };

  return (
    <IntegrationSection
      open={open}
      onToggle={onToggle}
      header={
        <>
          <Typography variant="subtitle1">{t("settings.integrations.retroachievementsHeading")}</Typography>
          <ConfiguredChip configured={status?.configured} />
        </>
      }
    >
      <Alert severity="info" sx={{ mb: 2 }}>
        <Trans
          i18nKey="settings.integrations.retroachievementsDescription"
          components={{
            1: (
              <Link
                href="https://retroachievements.org/settings"
                target="_blank"
                rel="noopener noreferrer"
              />
            ),
          }}
        />
      </Alert>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        {t("settings.integrations.retroachievementsUsernameHelper")}
      </Typography>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
        <TextField
          label={t("settings.integrations.retroachievementsUsernameLabel")}
          placeholder={t("settings.integrations.retroachievementsUsernamePlaceholder")}
          value={username}
          onChange={(e) => {
            setUsername(e.target.value);
            setTouched(true);
          }}
          sx={{ minWidth: 220 }}
        />
        <TextField
          label={t("settings.integrations.retroachievementsApiKeyLabel")}
          placeholder={
            status?.apiKeyConfigured
              ? t("settings.integrations.retroachievementsApiKeySet")
              : t("settings.integrations.retroachievementsApiKeyPlaceholder")
          }
          value={apiKey}
          type="password"
          autoComplete="off"
          onChange={(e) => {
            setApiKey(e.target.value);
            setTouched(true);
          }}
          sx={{ minWidth: 280 }}
        />
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={updateSettings.isPending || (!usernameChanged && !apiKeyChanged)}
        >
          {t("common.save")}
        </Button>
      </Box>
    </IntegrationSection>
  );
};

// The store region prices are fetched for (ITAD_COUNTRY / PLATPRICES_REGION /
// NINTENDO_COUNTRY), so a region that doesn't match what you expect is visible here
// rather than only in the prices.
const RegionChip = ({ configured, region }: { configured: boolean | undefined; region: string | undefined }) => {
  const { t } = useTranslation();
  if (!configured || !region) return null;
  return (
    <Chip size="small" variant="outlined" label={t("settings.integrations.regionLabel", { region })} />
  );
};

const ConfiguredChip = ({ configured }: { configured: boolean | undefined }) => {
  const { t } = useTranslation();
  if (configured === undefined) return null;
  return (
    <Chip
      size="small"
      label={
        configured
          ? t("settings.integrations.configuredLabel")
          : t("settings.integrations.notConfiguredLabel")
      }
      color={configured ? "success" : "default"}
      variant={configured ? "filled" : "outlined"}
    />
  );
};

const GogSection = ({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: status } = useIntegrationsStatus();
  const { data: gogStatus } = useGogStatus();
  const connectGog = useConnectGog();
  const disconnectGog = useDisconnectGog();
  const [redirectUrl, setRedirectUrl] = useState("");

  const configured = gogStatus?.configured ?? status?.gogConfigured ?? false;
  const username = gogStatus?.username ?? status?.gogUsername;

  const handleConnect = async () => {
    try {
      await connectGog.mutateAsync(redirectUrl.trim());
      setRedirectUrl("");
      toast.success(t("settings.integrations.gogConnectSuccessToast"), TOAST_OPTIONS);
    } catch {
      toast.error(t("settings.integrations.gogConnectErrorToast"), TOAST_OPTIONS);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnectGog.mutateAsync();
      toast.success(t("settings.integrations.gogDisconnectSuccessToast"), TOAST_OPTIONS);
    } catch {
      toast.error(t("settings.integrations.gogDisconnectErrorToast"), TOAST_OPTIONS);
    }
  };

  return (
    <IntegrationSection
      open={open}
      onToggle={onToggle}
      header={
        <>
          <Typography variant="subtitle1">{t("settings.integrations.gogHeading")}</Typography>
          <ConfiguredChip configured={configured} />
          <Box sx={{ flexGrow: 1 }} />
          {configured && (
            <Button variant="outlined" onClick={() => navigate("/settings/sync?tab=gog")}>
              {t("nav.gogSync")}
            </Button>
          )}
        </>
      }
    >
      <Alert severity="info" sx={{ mb: 2 }}>
        {t("settings.integrations.gogDescription")}
      </Alert>
      {configured ? (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
          <Typography variant="body2" color="text.secondary">
            {t("settings.integrations.gogConnectedAs", { username: username ?? "" })}
          </Typography>
          <Button variant="outlined" onClick={handleDisconnect} disabled={disconnectGog.isPending}>
            {t("settings.integrations.gogDisconnectButton")}
          </Button>
        </Box>
      ) : (
        <Stack spacing={2} sx={{ maxWidth: 500 }}>
          <Typography variant="body2" color="text.secondary">
            {t("settings.integrations.gogConnectSteps")}
          </Typography>
          <Box>
            <Button
              variant="contained"
              onClick={() => window.open(gogStatus?.authorizeUrl, "_blank", "noopener,noreferrer")}
              disabled={!gogStatus?.authorizeUrl}
            >
              {t("settings.integrations.gogSignInButton")}
            </Button>
          </Box>
          <TextField
            label={t("settings.integrations.gogRedirectUrlLabel")}
            placeholder={t("settings.integrations.gogRedirectUrlPlaceholder")}
            value={redirectUrl}
            onChange={(e) => setRedirectUrl(e.target.value)}
            helperText={t("settings.integrations.gogRedirectUrlHelper")}
            fullWidth
          />
          <Box>
            <Button
              variant="contained"
              onClick={handleConnect}
              disabled={connectGog.isPending || redirectUrl.trim() === ""}
            >
              {t("settings.integrations.gogConnectButton")}
            </Button>
          </Box>
        </Stack>
      )}
    </IntegrationSection>
  );
};

const IntegrationsPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: status } = useIntegrationsStatus();
  const updateSteamId = useUpdateSteamId();
  const [steamId, setSteamId] = useState("");
  const [touched, setTouched] = useState(false);
  // All sections start folded; expand one to see it.
  const [openSections, setOpenSections] = useState<Record<IntegrationSectionId, boolean>>({
    igdb: false,
    steam: false,
    gog: false,
    playnite: false,
    retroachievements: false,
    itad: false,
    platprices: false,
    nintendo: false,
  });
  const toggleSection = (id: IntegrationSectionId) =>
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));

  useEffect(() => {
    // Only seeds the field from the server value until the user actually edits it — without
    // the `touched` guard, typing before this query resolves gets silently overwritten the
    // moment it does (a real race: the query is often still loading on first paint).
    if (!touched) setSteamId(status?.steamId64 ?? "");
  }, [status?.steamId64, touched]);

  const handleSaveSteamId = async () => {
    try {
      await updateSteamId.mutateAsync(steamId.trim() === "" ? null : steamId.trim());
      setTouched(false);
      toast.success(t("settings.integrations.saveSuccessToast"), TOAST_OPTIONS);
    } catch (error) {
      console.error("Error saving Steam ID:", error);
      toast.error(t("settings.integrations.saveErrorToast"), TOAST_OPTIONS);
    }
  };

  return (
    <>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          {t("nav.integrations")}
        </Typography>
      </Box>
      <Card sx={{ maxWidth: 640 }}>
        <CardContent>
          <IntegrationSection
            open={openSections.igdb}
            onToggle={() => toggleSection("igdb")}
            header={
              <>
                <Box
                  component="img"
                  src={igdbLogo}
                  alt={t("settings.integrations.igdbLogoAlt")}
                  sx={{ width: 32 }}
                />
                <Typography variant="subtitle1">{t("settings.integrations.igdbHeading")}</Typography>
                <ConfiguredChip configured={status?.igdbConfigured} />
              </>
            }
          >
            <Alert severity="info">
              <Trans
                i18nKey="settings.integrations.igdbDescription"
                components={{ 1: <code />, 3: <code />, 5: <code /> }}
              />
            </Alert>
          </IntegrationSection>

          <Divider sx={{ my: 3 }} />

          <IntegrationSection
            open={openSections.steam}
            onToggle={() => toggleSection("steam")}
            header={
              <>
                <Box
                  component="img"
                  src={steamLogo}
                  alt={t("settings.integrations.steamLogoAlt")}
                  sx={{ width: 32 }}
                />
                <Typography variant="subtitle1">{t("settings.integrations.steamHeading")}</Typography>
                <ConfiguredChip configured={status?.steamApiKeyConfigured} />
                <Box sx={{ flexGrow: 1 }} />
                {status?.steamApiKeyConfigured && (
                  <Button variant="outlined" onClick={() => navigate("/settings/sync?tab=steam")}>
                    {t("nav.steamSync")}
                  </Button>
                )}
              </>
            }
          >
            <Alert severity="info" sx={{ mb: 2 }}>
              <Trans
                i18nKey="settings.integrations.steamDescription"
                components={{ 1: <code />, 3: <code /> }}
              />
            </Alert>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              {t("settings.integrations.steamIdHelperText")}
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
              <TextField
                label={t("settings.integrations.steamIdLabel")}
                placeholder={t("settings.integrations.steamIdPlaceholder")}
                value={steamId}
                onChange={(e) => {
                  setSteamId(e.target.value);
                  setTouched(true);
                }}
                sx={{ minWidth: 280 }}
              />
              <Button
                variant="contained"
                onClick={handleSaveSteamId}
                disabled={updateSteamId.isPending || steamId === (status?.steamId64 ?? "")}
              >
                {t("common.save")}
              </Button>
            </Box>
          </IntegrationSection>

          <Divider sx={{ my: 3 }} />

          <GogSection open={openSections.gog} onToggle={() => toggleSection("gog")} />

          <Divider sx={{ my: 3 }} />

          <PlayniteSection open={openSections.playnite} onToggle={() => toggleSection("playnite")} />

          <Divider sx={{ my: 3 }} />

          <RetroAchievementsSection
            open={openSections.retroachievements}
            onToggle={() => toggleSection("retroachievements")}
          />

          <Divider sx={{ my: 3 }} />

          <IntegrationSection
            open={openSections.itad}
            onToggle={() => toggleSection("itad")}
            header={
              <>
                <Box
                  component="img"
                  src={itadLogo}
                  alt={t("settings.integrations.itadLogoAlt")}
                  sx={{ width: 32 }}
                />
                <Typography variant="subtitle1">{t("settings.integrations.itadHeading")}</Typography>
                <ConfiguredChip configured={status?.itadConfigured} />
                <RegionChip configured={status?.itadConfigured} region={status?.itadCountry} />
              </>
            }
          >
            <Alert severity="info">
              <Trans
                i18nKey="settings.integrations.itadDescription"
                components={{ 1: <code />, 3: <code /> }}
              />
            </Alert>
          </IntegrationSection>

          <Divider sx={{ my: 3 }} />

          <IntegrationSection
            open={openSections.platprices}
            onToggle={() => toggleSection("platprices")}
            header={
              <>
                <Box
                  sx={{
                    bgcolor: "#161616",
                    borderRadius: 1,
                    px: 1,
                    py: 0.5,
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <Box
                    component="img"
                    src={platpricesLogo}
                    alt={t("settings.integrations.platpricesLogoAlt")}
                    sx={{ height: 22, display: "block" }}
                  />
                </Box>
                <Typography variant="subtitle1">
                  {t("settings.integrations.platpricesHeading")}
                </Typography>
                <ConfiguredChip configured={status?.platpricesConfigured} />
                <RegionChip configured={status?.platpricesConfigured} region={status?.platpricesRegion} />
              </>
            }
          >
            <Alert severity="info" sx={{ mb: 1.5 }}>
              <Trans
                i18nKey="settings.integrations.platpricesDescription"
                components={{ 1: <code />, 3: <code /> }}
              />
            </Alert>
            <Alert severity="warning" sx={{ mb: 1.5 }}>
              {t("settings.integrations.platpricesRegionCaveat")}
            </Alert>
            <Typography variant="caption" color="text.secondary">
              <Trans
                i18nKey="settings.integrations.platpricesCredit"
                components={{
                  1: <Link href="https://platprices.com" target="_blank" rel="noopener noreferrer" />,
                }}
              />
            </Typography>
          </IntegrationSection>

          <Divider sx={{ my: 3 }} />

          <IntegrationSection
            open={openSections.nintendo}
            onToggle={() => toggleSection("nintendo")}
            header={
              <>
                <Typography variant="subtitle1">{t("settings.integrations.nintendoHeading")}</Typography>
                <ConfiguredChip configured />
                <RegionChip configured region={status?.nintendoCountry} />
              </>
            }
          >
            <Alert severity="info" sx={{ mb: 1.5 }}>
              <Trans
                i18nKey="settings.integrations.nintendoDescription"
                components={{ 1: <code />, 3: <code /> }}
              />
            </Alert>
            <Alert severity="warning" sx={{ mb: 1.5 }}>
              {t("settings.integrations.nintendoRegionCaveat")}
            </Alert>
            <Typography variant="caption" color="text.secondary">
              {t("settings.integrations.nintendoCredit")}
            </Typography>
          </IntegrationSection>
        </CardContent>
      </Card>
    </>
  );
};

export default IntegrationsPage;
