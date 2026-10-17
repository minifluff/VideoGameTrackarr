import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import {
  fetchDisplayModeSettings,
  fetchDisplayModeSlides,
  type DisplayModeSlide,
} from "../api/displayMode";

interface WakeLockSentinelLike {
  release: () => Promise<void>;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const FADE_MS = 600;

const DisplayModePage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [slides, setSlides] = useState<DisplayModeSlide[]>([]);
  const [index, setIndex] = useState(0);
  const [intervalSeconds, setIntervalSeconds] = useState(10);
  const [showTitle, setShowTitle] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fading, setFading] = useState(false);
  const fetchingRef = useRef(false);

  // Keep the screen awake while the slideshow runs (phones, tablets, TVs).
  useEffect(() => {
    let lock: WakeLockSentinelLike | null = null;
    let cancelled = false;
    const request = async () => {
      try {
        const nav = navigator as Navigator & {
          wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
        };
        if (!nav.wakeLock) return;
        const sentinel = await nav.wakeLock.request("screen");
        if (cancelled) {
          await sentinel.release().catch(() => {});
        } else {
          lock = sentinel;
        }
      } catch {
        // Wake Lock unsupported or denied — the slideshow still works.
      }
    };
    request();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") request();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (lock) lock.release().catch(() => {});
    };
  }, []);

  // Load settings and the first batch of slides.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [settings, firstBatch] = await Promise.all([
          fetchDisplayModeSettings(),
          fetchDisplayModeSlides(),
        ]);
        if (cancelled) return;
        setIntervalSeconds(settings.slideIntervalSeconds);
        setShowTitle(settings.showTitle);
        setSlides(shuffle(firstBatch));
      } catch {
        // surfaced via the empty state below
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchMore = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const batch = await fetchDisplayModeSlides();
      if (batch.length > 0) {
        setSlides((prev) => [...prev, ...shuffle(batch)]);
      }
    } catch {
      // A failed refill just means the current loop repeats.
    } finally {
      fetchingRef.current = false;
    }
  }, []);

  // Advance on the configured interval, with a fade between slides.
  useEffect(() => {
    if (loading || slides.length === 0) return;
    if (index >= slides.length - 5) void fetchMore();
    const durationMs = Math.max(intervalSeconds, 1) * 1000;
    const fadeTimer = window.setTimeout(() => setFading(true), Math.max(durationMs - FADE_MS, 0));
    const advanceTimer = window.setTimeout(() => {
      setIndex((i) => (i + 1) % slides.length);
      setFading(false);
    }, durationMs);
    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(advanceTimer);
    };
  }, [index, slides, loading, intervalSeconds, fetchMore]);

  // Preload the next cover so transitions never flash.
  useEffect(() => {
    if (slides.length === 0) return;
    const next = slides[(index + 1) % slides.length];
    const img = new Image();
    img.src = next.coverUrl;
  }, [index, slides]);

  if (loading) {
    return (
      <Box
        sx={{
          position: "fixed",
          inset: 0,
          zIndex: 1300,
          bgcolor: "black",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <CircularProgress sx={{ color: "white" }} />
      </Box>
    );
  }

  if (slides.length === 0) {
    return (
      <Box
        sx={{
          position: "fixed",
          inset: 0,
          zIndex: 1300,
          bgcolor: "black",
          display: "flex",
          flexDirection: "column",
          gap: 2,
          alignItems: "center",
          justifyContent: "center",
          p: 3,
        }}
      >
        <Typography variant="h6" sx={{ color: "white", textAlign: "center" }}>
          {t("displayMode.noSlides")}
        </Typography>
        <Button variant="contained" onClick={() => navigate("/")}>
          {t("displayMode.backToDashboard")}
        </Button>
      </Box>
    );
  }

  const slide = slides[index % slides.length];

  return (
    <Box
      onClick={() => navigate("/")}
      sx={{
        position: "fixed",
        inset: 0,
        zIndex: 1300,
        bgcolor: "black",
        cursor: "pointer",
        overflow: "hidden",
      }}
    >
      <Box
        component="img"
        key={slide.id}
        src={slide.coverUrl}
        alt={slide.name}
        onError={() => setIndex((i) => (i + 1) % slides.length)}
        sx={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "contain",
          opacity: fading ? 0 : 1,
          transition: `opacity ${FADE_MS}ms ease`,
        }}
      />
      {showTitle && (
        <Typography
          variant="h6"
          sx={{
            position: "absolute",
            bottom: 24,
            left: 0,
            right: 0,
            textAlign: "center",
            color: "white",
            px: 2,
            textShadow: "0 2px 8px rgba(0,0,0,0.9)",
            opacity: fading ? 0 : 1,
            transition: `opacity ${FADE_MS}ms ease`,
          }}
        >
          {slide.name}
        </Typography>
      )}
    </Box>
  );
};

export default DisplayModePage;
