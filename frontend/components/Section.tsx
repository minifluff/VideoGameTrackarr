import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

// Ported from upstream's Detail.tsx: a titled section (overline title + rule + action)
// and a horizontally scrolling strip of cards. Upstream's scroll-margin constant lived on
// its Page wrapper, which this fork doesn't have, so it's left out.

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

export const Strip = ({ columnWidth = 150, children }: { columnWidth?: number; children: ReactNode }) => (
  <Box
    sx={{
      display: "grid",
      gridAutoFlow: "column",
      gridAutoColumns: columnWidth,
      gap: 1.5,
      overflowX: "auto",
      pb: 1,
      scrollbarWidth: "thin",
    }}
  >
    {children}
  </Box>
);
