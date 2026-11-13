// Component-level tests for BookshelfPage live here, not in BookshelfPage.test.ts:
// that file is .ts (pure-function tests) and cannot hold JSX.
// (Filename is historical: the Load more button is gone, replaced by the
// progressive auto-load in useProgressiveRows — the file is kept because
// snapshot pushes cannot delete files.)
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BookshelfEntry } from "../../api/types";
import BookshelfPage from "../BookshelfPage";

// Rendering 600 heavy spine cases takes ~9s in jsdom (the no-observer test
// renders all of them); the default 5s timeout flakes on that, so this file
// gets room — the tests themselves are not slow by design.
vi.setConfig({ testTimeout: 30_000 });

const mockFetchEntries = vi.fn();
vi.mock("../../api/games", () => ({
  fetchBookshelfEntries: (...args: unknown[]) => mockFetchEntries(...args),
}));
vi.mock("../../hooks/usePlatforms", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../hooks/usePlatforms")>();
  return {
    ...actual,
    // The template dialog (always mounted) needs the module's other hooks;
    // only the platforms query itself is stubbed out.
    usePlatforms: () => ({ data: [] }),
  };
});

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <BookshelfPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

function shelfEntries(count: number): BookshelfEntry[] {
  return Array.from({ length: count }, (_, i) => ({
    gameId: 100 + i,
    gameSlug: `game-${i + 1}`,
    gameUuid: `uuid-shelf-${i}`,
    name: `Game ${i + 1}`,
    platformLabel: "PS5",
    formats: ["physical"],
    hideFromPublic: false,
  }));
}

describe("BookshelfPage progressive loading", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("grows rows automatically when the sentinel scrolls into view, with no button", async () => {
    // 600 entries make far more than 10 rows at any pack width. The observer
    // mock captures its callback instead of firing on observe, so each manual
    // fire is exactly one chunk — case counts (not a specific late game) prove
    // the cap and the growth, independent of jsdom's pack width.
    let latestCallback: IntersectionObserverCallback | null = null;
    class ManualIntersectionObserver {
      constructor(callback: IntersectionObserverCallback) {
        latestCallback = callback;
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal("IntersectionObserver", ManualIntersectionObserver);
    mockFetchEntries.mockResolvedValue(shelfEntries(600));
    renderPage();

    expect(await screen.findByTitle("Game 1 — PS5")).toBeInTheDocument();
    const casesBefore = screen.getAllByTitle(/— PS5$/).length;
    expect(casesBefore).toBeGreaterThan(0);
    expect(casesBefore).toBeLessThan(600);
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();

    expect(latestCallback).not.toBeNull();
    act(() => {
      latestCallback!([{ isIntersecting: true } as IntersectionObserverEntry], null as unknown as IntersectionObserver);
    });
    const casesAfter = screen.getAllByTitle(/— PS5$/).length;
    expect(casesAfter).toBeGreaterThan(casesBefore);
    expect(casesAfter).toBeLessThan(600);
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();
  });

  it("renders the whole shelf when IntersectionObserver is unavailable", async () => {
    // jsdom has no IntersectionObserver: with no sentinel to watch and no
    // button anymore, the fallback is the full shelf rather than stranding
    // the user at the first chunk.
    expect(typeof IntersectionObserver).toBe("undefined");
    mockFetchEntries.mockResolvedValue(shelfEntries(600));
    renderPage();

    expect(await screen.findByTitle("Game 600 — PS5")).toBeInTheDocument();
    expect(screen.getAllByTitle(/— PS5$/).length).toBe(600);
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();
  });
});

// Toolbar: Options holds the case-size slider and the Mixed switch; Platform
// and Format each get their own icon with a popout menu, like Options.
describe("BookshelfPage toolbar", () => {
  const toolbarEntries = (): BookshelfEntry[] => [
    { gameId: 1, gameSlug: "zelda", gameUuid: "uuid-1", name: "Zelda", platformLabel: "PS5", formats: ["physical"], hideFromPublic: false },
    { gameId: 2, gameSlug: "mario", gameUuid: "uuid-2", name: "Mario", platformLabel: "PS5", formats: ["digital"], hideFromPublic: false },
    { gameId: 3, gameSlug: "metroid", gameUuid: "uuid-3", name: "Metroid", platformLabel: "Switch", formats: ["physical"], hideFromPublic: false },
  ];

  beforeEach(() => {
    // Display prefs persist in localStorage across tests in this file;
    // start each toolbar test from the defaults.
    localStorage.clear();
    mockFetchEntries.mockResolvedValue(toolbarEntries());
  });

  it("shows the Options, Platform and Format buttons next to the search field", async () => {
    renderPage();
    expect(await screen.findByPlaceholderText("Search the shelf…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Options" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Platform" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Format" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sort By" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Filters" })).not.toBeInTheDocument();
  });

  it("opens the options menu with the case-size slider and the Mixed switch", async () => {
    renderPage();
    await screen.findByPlaceholderText("Search the shelf…");
    fireEvent.click(screen.getByRole("button", { name: "Options" }));
    expect(await screen.findByRole("slider", { name: "Case size" })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Mixed" })).not.toBeChecked();
  });

  it("Mixed drops the platform bookends so every case flows as one run", async () => {
    renderPage();
    await screen.findByTitle("Zelda — PS5");
    // Grouped: each platform leads with a bookend tile.
    expect(screen.getByTitle("Spine template for PS5")).toBeInTheDocument();
    expect(screen.getByTitle("Spine template for Switch")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Options" }));
    fireEvent.click(await screen.findByRole("switch", { name: "Mixed" }));
    expect(screen.queryByTitle("Spine template for PS5")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Spine template for Switch")).not.toBeInTheDocument();
    expect(screen.getByTitle("Zelda — PS5")).toBeInTheDocument();
    expect(screen.getByTitle("Metroid — Switch")).toBeInTheDocument();
  });

  it("filters by platform from its popout", async () => {
    renderPage();
    await screen.findByTitle("Zelda — PS5");
    fireEvent.click(screen.getByRole("button", { name: "Platform" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Switch" }));
    expect(await screen.findByTitle("Metroid — Switch")).toBeInTheDocument();
    expect(screen.queryByTitle("Zelda — PS5")).not.toBeInTheDocument();
    // The badge on the Platform button marks the active filter.
    expect(within(screen.getByRole("button", { name: "Platform" })).getByText("1")).toBeInTheDocument();
  });

  it("filters by format from its popout", async () => {
    renderPage();
    await screen.findByTitle("Zelda — PS5");
    fireEvent.click(screen.getByRole("button", { name: "Format" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "digital" }));
    expect(await screen.findByTitle("Mario — PS5")).toBeInTheDocument();
    expect(screen.queryByTitle("Zelda — PS5")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Metroid — Switch")).not.toBeInTheDocument();
  });

  it("hides hidden games unless Show Hidden is checked in Options", async () => {
    mockFetchEntries.mockResolvedValue([
      ...toolbarEntries(),
      { gameId: 4, gameSlug: "hidden-gem", gameUuid: "uuid-4", name: "Hidden Gem", platformLabel: "PS5", formats: ["physical"], hideFromPublic: true },
    ]);
    renderPage();
    await screen.findByTitle("Zelda — PS5");
    expect(screen.queryByTitle("Hidden Gem — PS5")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Options" }));
    const checkbox = await screen.findByRole("checkbox", { name: "Show Hidden" });
    expect(checkbox).not.toBeChecked();
    fireEvent.click(checkbox);
    expect(await screen.findByTitle("Hidden Gem — PS5")).toBeInTheDocument();
  });
});
