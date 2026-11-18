import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { describe, expect, it, vi } from "vitest";
import type { GameProgress } from "../../api/types";
import { useGameProgressList } from "../../hooks/useProgress";
import { createM3Theme } from "../../theme/createM3Theme";
import GameProgressSection from "../GameProgressSection";

// The progress list is mocked so rows render without a server; the play
// sessions hooks stay live and fail into their empty state, as before.
vi.mock("../../hooks/useProgress", () => ({
  useGameProgressList: vi.fn(),
  useCreateGameProgress: () => ({ mutateAsync: vi.fn() }),
  useUpdateGameProgress: () => ({ mutateAsync: vi.fn() }),
  useDeleteGameProgress: () => ({ mutateAsync: vi.fn() }),
}));

const mockedProgressList = vi.mocked(useGameProgressList);

// Same wrapper as the DashboardPage test: the section's queries have no server in
// jsdom, so they fail into their error state and the sections render empty.
const theme = createM3Theme("light", "normal");

function renderSection(ui: React.ReactElement, progressRows: GameProgress[] = []) {
  mockedProgressList.mockReturnValue({
    data: progressRows,
  } as unknown as ReturnType<typeof useGameProgressList>);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>{ui}</ThemeProvider>
    </QueryClientProvider>
  );
}

const steamRow: GameProgress = {
  id: 1,
  gameId: 1,
  platformId: 1,
  platformName: "Steam",
  playStatus: "playing",
  playtimeMinutes: 243,
  rating: null,
  review: null,
  startedAt: null,
  completedAt: null,
  lastPlayedAt: "2022-04-30",
};

describe("GameProgressSection", () => {
  it("shows the summary facts and both sections with their actions", async () => {
    renderSection(
      <GameProgressSection gameId={1} libraryItems={[]} platforms={[]} playStatus="playing" />
    );

    // CardHeader renders its title as a span, not a heading, like the other detail
    // sections (Tags, Addons, Notes).
    expect(screen.getByText("Progress")).toBeInTheDocument();
    expect(
      screen.getByText("Play status and playtime, tracked separately per owned platform")
    ).toBeInTheDocument();
    expect(screen.getByText("Play Sessions")).toBeInTheDocument();
    expect(
      screen.getByText("Log individual sessions per platform if you want a finer-grained history")
    ).toBeInTheDocument();
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

    expect(screen.getByText("Progress")).toBeInTheDocument();
    expect(screen.getByText("Not set")).toBeInTheDocument();
  });

  it("shows the platform name once per progress row, with no platform badge", async () => {
    renderSection(
      <GameProgressSection gameId={1} libraryItems={[]} platforms={[]} playStatus="playing" />,
      [steamRow]
    );

    // The row's title is the platform name; the badge that used to repeat it
    // is gone, like the library rows.
    expect(screen.getByRole("button", { name: "Steam" })).toBeInTheDocument();
    expect(screen.getAllByText("Steam")).toHaveLength(1);
  });
});
