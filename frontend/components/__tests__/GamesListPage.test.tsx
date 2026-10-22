import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { LibraryListItem } from "../../api/types";
import GamesListPage from "../GamesListPage";

const items: LibraryListItem[] = [
  {
    id: 1,
    gameId: 10,
    gameName: "Astro Bot",
    gameUuid: "uuid-1",
    platformName: "PlayStation 5",
    edition: null,
    format: "physical",
    firstReleaseDate: null,
    dateAdded: null,
    tagNames: [],
    notes: null,
  },
  {
    id: 2,
    gameId: 11,
    gameName: "Zelda: Tears of the Kingdom",
    gameUuid: "uuid-2",
    platformName: "Nintendo Switch",
    edition: null,
    format: "digital",
    firstReleaseDate: null,
    dateAdded: null,
    tagNames: [],
    notes: null,
  },
];

vi.mock("../../api/library", () => ({
  listAllLibraryItems: () => Promise.resolve(items),
  bulkUpdateLibraryItems: vi.fn(),
}));

vi.mock("../../hooks/usePlatforms", () => ({ usePlatforms: () => ({ data: [] }) }));
vi.mock("../../hooks/useRegions", () => ({ useRegions: () => ({ data: [] }) }));
vi.mock("../../hooks/useLibrary", () => ({
  useBulkUpdateLibraryItems: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <GamesListPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("GamesListPage selection", () => {
  it("selects rows individually and via the header checkbox, showing the Edit action", async () => {
    const user = userEvent.setup();
    renderPage();

    const astroCheckbox = await screen.findByRole("checkbox", { name: "Astro Bot" });
    await user.click(astroCheckbox);
    expect(await screen.findByText("1 selected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: "Select page" }));
    expect(await screen.findByText("2 selected")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear selection" }));
    expect(screen.queryByText("2 selected")).not.toBeInTheDocument();
  });

  it("does not navigate when clicking a row checkbox", async () => {
    const user = userEvent.setup();
    renderPage();

    const zeldaCheckbox = await screen.findByRole("checkbox", {
      name: "Zelda: Tears of the Kingdom",
    });
    await user.click(zeldaCheckbox);
    // Still on the list (selection bar visible), not navigated to the game page.
    expect(await screen.findByText("1 selected")).toBeInTheDocument();
  });
});
