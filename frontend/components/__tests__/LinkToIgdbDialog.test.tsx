import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "@mui/material/styles";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { createM3Theme } from "../../theme/createM3Theme";
import type { IgdbSearchResult } from "../../api/types";
import LinkToIgdbDialog from "../LinkToIgdbDialog";

// The relink mutation is the thing under test: it resolves to the relinked
// game (same row, new IGDB slug), so the dialog must navigate to the new
// slug. Every other mutation is a no-op stub.
const mockChangeMutate = vi.fn(async () => ({
  id: 1,
  slug: "new-slug",
  uuid: "uuid-1",
  name: "New Game",
}));

vi.mock("../../hooks/useGames", () => ({
  useChangeIgdbLink: () => ({ isPending: false, mutateAsync: mockChangeMutate }),
  useLinkGameToIgdb: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useLinkGameToIgdbViaParent: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useMergeGameIntoIgdb: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useGames: () => ({ data: [] }),
}));

const searchResult: IgdbSearchResult = {
  igdbId: 2002,
  name: "New Game",
  slug: "new-slug",
  summary: null,
  coverUrl: null,
  category: "main_game",
  firstReleaseDate: null,
  parentGame: null,
};

vi.mock("../../hooks/useIgdbSearch", () => ({
  useIgdbSearch: () => ({ data: [searchResult], isFetching: false, error: null }),
  isIgdbIdQuery: (query: string) => /^(?:igdb:)?\d+$/i.test(query.trim()),
}));

const theme = createM3Theme("light", "normal");

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

describe("LinkToIgdbDialog change mode", () => {
  it("lands on the new game page after relinking to a fresh IGDB id", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider theme={theme}>
        <MemoryRouter initialEntries={["/game/old-slug"]}>
          <LocationProbe />
          <LinkToIgdbDialog
            open
            gameId={1}
            gameName="Old Game"
            gameCategory="main_game"
            onClose={() => undefined}
            changeMode
          />
        </MemoryRouter>
      </ThemeProvider>
    );

    // The suggestion card for the new IGDB entry, then its Add button.
    expect(await screen.findByText("New Game")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent("/game/new-slug")
    );
    expect(mockChangeMutate).toHaveBeenCalledWith(2002);
  });
});
