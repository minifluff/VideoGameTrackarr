import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { describe, expect, it } from "vitest";
import { createM3Theme } from "../../theme/createM3Theme";
import GameProgressSection from "../GameProgressSection";

// Same wrapper as the DashboardPage test: the section's queries have no server in
// jsdom, so they fail into their error state and the sections render empty.
const theme = createM3Theme("light", "normal");

function renderSection(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>{ui}</ThemeProvider>
    </QueryClientProvider>
  );
}

describe("GameProgressSection", () => {
  it("shows the summary facts and both sections with their actions", async () => {
    renderSection(
      <GameProgressSection gameId={1} libraryItems={[]} platforms={[]} playStatus="playing" />
    );

    expect(await screen.findByRole("heading", { name: "Progress" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Play Sessions" })).toBeInTheDocument();
    // Summary facts: the overall status plus empty playtime/last-played.
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("Playing")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log session" })).toBeInTheDocument();
    expect(screen.getByText("No sessions logged yet.")).toBeInTheDocument();
  });

  it("shows Not set when the game has no play status", async () => {
    renderSection(
      <GameProgressSection gameId={1} libraryItems={[]} platforms={[]} playStatus={null} />
    );

    expect(await screen.findByRole("heading", { name: "Progress" })).toBeInTheDocument();
    expect(screen.getByText("Not set")).toBeInTheDocument();
  });
});
