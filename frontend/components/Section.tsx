import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

// Ported from upstream's Detail.tsx: a titled section (overline title + rule + action).
// Upstream's scroll-margin constant lived on its Page wrapper, which this fork doesn't
// have, so it's left out. (The old horizontally scrolling Strip went away with the
// dashboard rows' move to CardCarousel in upstream 2.4.3's style — no user left.)

export const Section = ({
  id,
  title,
  action,
  children,
}: {
  id?: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) => (
  <Box component="section" id={id} sx={{ pt: { xs: 2.25, md: 2.75 } }}>
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1.5, minHeight: 28 }}>
      <Typography variant="overline" component="h2" sx={{ color: "primary.main", fontWeight: 700, lineHeight: 1.4 }}>
        {title}
      </Typography>
      <Box sx={{ flexGrow: 1, height: "1px", bgcolor: "divider" }} />
      {action}
    </Box>
    {children}
  </Box>
);
