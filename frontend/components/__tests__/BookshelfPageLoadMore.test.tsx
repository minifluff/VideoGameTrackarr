// Component-level tests for BookshelfPage live here, not in BookshelfPage.test.ts:
// that file is .ts (pure-function tests) and cannot hold JSX.
// (Filename is historical: the Load more button is gone, replaced by the
// progressive auto-load in useProgressiveRows — the file is kept because
// snapshot pushes cannot delete files.)
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
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
