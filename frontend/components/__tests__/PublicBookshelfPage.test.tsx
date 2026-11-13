import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, MemoryRouter, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BookshelfEntry, PublicBookshelf, PublicBookshelfPlatform } from "../../api/types";
import PublicBookshelfPage from "../PublicBookshelfPage";

const entries: BookshelfEntry[] = [
  {
    gameId: 100,
    gameSlug: "game-1",
    gameUuid: "uuid-shelf-1",
    name: "Game 1",
    platformLabel: "PS5",
    formats: ["physical"],
    hideFromPublic: false,
  },
  {
    gameId: 101,
    gameSlug: "game-2",
    gameUuid: "uuid-shelf-2",
    name: "Game 2",
    platformLabel: "Nintendo Switch",
    formats: ["digital"],
    hideFromPublic: false,
  },
];

const platforms: PublicBookshelfPlatform[] = [
  {
    label: "PS5",
    name: "PlayStation 5",
    abbreviation: "PS5",
    spineTemplateUrl: null,
    caseHeightMm: null,
    caseSpineMm: null,
    spineColor: null,
    spineIcon: null,
    spineIconUrl: null,
  },
  {
    label: "Nintendo Switch",
    name: "Nintendo Switch",
    abbreviation: "NS",
    spineTemplateUrl: null,
    caseHeightMm: null,
    caseSpineMm: null,
    spineColor: null,
    spineIcon: null,
    spineIconUrl: null,
  },
];

const mockFetchPublicBookshelf = vi.fn(
  (..._args: unknown[]) => Promise.resolve({ entries, platforms } satisfies PublicBookshelf)
);

vi.mock("../../api/public", () => ({
  fetchPublicBookshelf: (...args: unknown[]) => mockFetchPublicBookshelf(...args),
}));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/public/test-token/bookshelf"]}>
        <Routes>
          <Route path="/public/:token/bookshelf" element={<PublicBookshelfPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("PublicBookshelfPage toolbar", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("shows the Options, Platform and Format buttons next to the search field", async () => {
    renderPage();

    expect(await screen.findByTitle("Game 1 — PS5")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Options" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Platform" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Format" })).toBeInTheDocument();
    // The inline filter dropdowns are gone — no comboboxes on the page.
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("filters by platform from its popout", async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByTitle("Game 2 — Nintendo Switch")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Platform" }));
    await user.click(
      await screen.findByRole("menuitem", { name: "PlayStation 5 (PS5)" })
    );
    expect(await screen.findByTitle("Game 1 — PS5")).toBeInTheDocument();
    expect(screen.queryByTitle("Game 2 — Nintendo Switch")).not.toBeInTheDocument();
    // The badge on the Platform button marks the active filter.
    const platformButton = screen.getByRole("button", { name: "Platform" });
    expect(within(platformButton).getByText("1")).toBeInTheDocument();
  });

  it("filters by format from its popout", async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByTitle("Game 2 — Nintendo Switch")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Format" }));
    await user.click(await screen.findByRole("menuitem", { name: "digital" }));
    expect(await screen.findByTitle("Game 2 — Nintendo Switch")).toBeInTheDocument();
    expect(screen.queryByTitle("Game 1 — PS5")).not.toBeInTheDocument();
  });

  it("shows the case-size slider and Mixed switch in the options popout", async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByTitle("Game 1 — PS5")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Options" }));
    expect(await screen.findByRole("slider", { name: "Case size" })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Mixed" })).not.toBeChecked();
  });
});
