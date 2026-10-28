// Component-level tests for BookshelfPage live here, not in BookshelfPage.test.ts:
// that file is .ts (pure-function tests) and cannot hold JSX.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { BookshelfEntry } from "../../api/types";
import BookshelfPage from "../BookshelfPage";

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

describe("BookshelfPage load more", () => {
  it("caps initially rendered rows behind a Load more button", async () => {
    const user = userEvent.setup();
    // 600 entries make far more than 10 rows at any pack width, so the first
    // chunk never covers the whole shelf. Case counts (not a specific late
    // game) prove the cap and the growth, independent of jsdom's pack width.
    const entries: BookshelfEntry[] = Array.from({ length: 600 }, (_, i) => ({
      gameId: 100 + i,
      gameSlug: `game-${i + 1}`,
      gameUuid: `uuid-shelf-${i}`,
      name: `Game ${i + 1}`,
      platformLabel: "PS5",
      formats: ["physical"],
    }));
    mockFetchEntries.mockResolvedValue(entries);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <BookshelfPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(await screen.findByTitle("Game 1 — PS5")).toBeInTheDocument();
    const casesBefore = screen.getAllByTitle(/— PS5$/).length;
    expect(casesBefore).toBeGreaterThan(0);
    expect(casesBefore).toBeLessThan(600);
    expect(screen.getByRole("button", { name: "Load more" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Load more" }));
    expect(screen.getAllByTitle(/— PS5$/).length).toBeGreaterThan(casesBefore);
  });
});
