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
    status: "wishlist",
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
    status: "owned",
    platformName: "Nintendo Switch",
    edition: null,
    format: "digital",
    firstReleaseDate: null,
    dateAdded: null,
    tagNames: [],
    notes: null,
  },
];

// Rest-typed so the factory's lazy wrapper below typechecks: the wrapper must
// not dereference this at factory time (hoisted factories run before this
// initializer), only when the query actually calls it.
const mockListItems = vi.fn((..._args: unknown[]) => Promise.resolve(items));

vi.mock("../../api/library", () => ({
  listAllLibraryItems: (...args: unknown[]) => mockListItems(...args),
  bulkUpdateLibraryItems: vi.fn(),
}));

vi.mock("../../hooks/usePlatforms", () => ({ usePlatforms: () => ({ data: [] }) }));
vi.mock("../../hooks/useRegions", () => ({ useRegions: () => ({ data: [] }) }));
const bulkDeleteMutate = vi.fn().mockResolvedValue({ deleted: 1 });

vi.mock("../../hooks/useLibrary", () => ({
  useBulkUpdateLibraryItems: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useBulkDeleteLibraryItems: () => ({ mutateAsync: bulkDeleteMutate, isPending: false }),
  useMoveLibraryItem: () => ({ mutate: vi.fn(), isPending: false }),
  useSplitLibraryItem: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("../../hooks/useGames", () => ({ useGames: () => ({ data: [] }) }));

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

describe("GamesListPage title", () => {
  it("shows the Individual Games heading", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { name: "Individual Games" })).toBeInTheDocument();
  });
});

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

  it("deletes the selection only after confirming the warning dialog", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("checkbox", { name: "Astro Bot" }));
    expect(await screen.findByText("1 selected")).toBeInTheDocument();

    // The red Delete button sits in the selection bar...
    await user.click(screen.getByRole("button", { name: "Delete" }));
    // ...and nothing is deleted until the warning dialog is confirmed.
    expect(await screen.findByText("Delete 1 items?")).toBeInTheDocument();
    expect(bulkDeleteMutate).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(bulkDeleteMutate).toHaveBeenCalledWith([1]);
    expect(screen.queryByText("1 selected")).not.toBeInTheDocument();
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

describe("GamesListPage filter sizes", () => {
  it("renders the Platform and Format dropdowns at the search bar's small height", async () => {
    renderPage();

    // The page's only two comboboxes are the Platform and Format dropdowns
    // (the search field itself is a plain text input).
    const selects = await screen.findAllByRole("combobox");
    expect(selects).toHaveLength(2);
    const search = screen.getByLabelText("Search games");
    for (const input of [...selects, search]) {
      expect(input.closest(".MuiInputBase-root")).toHaveClass("MuiInputBase-sizeSmall");
    }
  });
});

describe("GamesListPage status column", () => {
  it("shows an Owned pill and a Wishlist pill", async () => {
    renderPage();

    expect(await screen.findByText("Owned")).toBeInTheDocument();
    expect(screen.getByText("Wishlist")).toBeInTheDocument();
  });

  it("places the Status column between Edition and Notes", async () => {
    renderPage();

    const headers = await screen.findAllByRole("columnheader");
    const labels = headers.map((h) =>
      (h.textContent ?? "").replace(/sorted (ascending|descending)/, "").trim(),
    );
    expect(labels).toEqual(["", "Name", "Platform", "Format", "Edition", "Status", "Notes", ""]);
  });

  it("sorts by status when the Status header is clicked", async () => {
    const user = userEvent.setup();
    renderPage();

    // Default sort is Name ascending: Astro Bot (wishlist) first.
    const rowsBefore = await screen.findAllByRole("row");
    expect(rowsBefore[1]).toHaveTextContent("Astro Bot");

    await user.click(screen.getByRole("button", { name: "Status" }));
    // Status ascending puts owned first, so Zelda jumps ahead of Astro Bot.
    const rowsAfter = screen.getAllByRole("row");
    expect(rowsAfter[1]).toHaveTextContent("Zelda: Tears of the Kingdom");
    expect(rowsAfter[2]).toHaveTextContent("Astro Bot");
  });
});

describe("GamesListPage move action", () => {
  it("shows a Move button on every row and opens the move dialog for that row", async () => {
    const user = userEvent.setup();
    renderPage();

    const moveButtons = await screen.findAllByRole("button", { name: "Move to another game" });
    expect(moveButtons).toHaveLength(2);

    await user.click(moveButtons[0]);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Move library item")).toBeInTheDocument();
    expect(screen.getByText(/Astro Bot \(PlayStation 5\)/)).toBeInTheDocument();
  });

  it("does not navigate when clicking a row Move button", async () => {
    const user = userEvent.setup();
    renderPage();

    const moveButtons = await screen.findAllByRole("button", { name: "Move to another game" });
    await user.click(moveButtons[1]);
    // The dialog belongs to the list page, so it only shows if we stayed put.
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/Zelda: Tears of the Kingdom \(Nintendo Switch\)/)).toBeInTheDocument();
    expect(screen.queryByText(/selected/)).not.toBeInTheDocument();
  });
});

describe("GamesListPage bulk delete pagination", () => {
  it("returns to the first page after deleting every item on the last page", async () => {
    const user = userEvent.setup();
    // Zero-padded so the page's Name-ascending sort keeps numeric order.
    const many: LibraryListItem[] = Array.from({ length: 26 }, (_, i) => ({
      ...items[0],
      id: 100 + i,
      gameId: 100 + i,
      gameName: `Game ${String(i + 1).padStart(2, "0")}`,
      gameUuid: `uuid-many-${i}`,
    }));
    mockListItems.mockResolvedValueOnce(many);
    renderPage();

    await screen.findByText("Game 01");
    // 25 rows per page leaves a second page holding only Game 26.
    await user.click(screen.getByText("50"));
    await user.click(screen.getByRole("option", { name: "25" }));
    await user.click(screen.getByRole("button", { name: "Go to next page" }));
    expect(await screen.findByText("Game 26")).toBeInTheDocument();
    expect(screen.queryByText("Game 01")).not.toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: "Select page" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(await screen.findByText("Delete 1 items?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Delete" }));

    // The delete resets the page: the first page's items are visible again
    // instead of a blank second page.
    expect(await screen.findByText("Game 01")).toBeInTheDocument();
  });
});
