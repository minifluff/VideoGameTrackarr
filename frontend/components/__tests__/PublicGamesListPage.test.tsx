import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, MemoryRouter, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicGameSummary } from "../../api/types";
import PublicGamesListPage from "../PublicGamesListPage";

const games: PublicGameSummary[] = [
  {
    id: 10,
    name: "Astro Bot",
    coverUrl: null,
    category: null,
    firstReleaseDate: null,
    owned: false,
    wishlisted: true,
    ownedPlatforms: ["PlayStation 5"],
    ownedFormats: ["physical"],
    ownedEditions: [],
    ownedCopies: [{ platform: "PlayStation 5", edition: null, format: "physical" }],
  },
  {
    id: 11,
    name: "Zelda: Tears of the Kingdom",
    coverUrl: null,
    category: null,
    firstReleaseDate: null,
    owned: true,
    wishlisted: false,
    ownedPlatforms: ["Nintendo Switch"],
    ownedFormats: ["digital"],
    ownedEditions: [],
    ownedCopies: [{ platform: "Nintendo Switch", edition: null, format: "digital" }],
  },
];

vi.mock("../../hooks/usePublic", () => ({
  usePublicGames: () => ({ data: games, isLoading: false }),
}));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/public/test-token/games/list"]}>
        <Routes>
          <Route path="/public/:token/games/list" element={<PublicGamesListPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

// The toolbar's Platform button shares its name with the table's Platform
// column header — the toolbar one is the one carrying the badge.
function toolbarButton(name: string) {
  const button = screen
    .getAllByRole("button", { name })
    .find((candidate) => candidate.querySelector(".MuiBadge-root"));
  expect(button).toBeTruthy();
  return button as HTMLElement;
}

describe("PublicGamesListPage toolbar", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("shows the Options, Platform and Format buttons next to the search field", async () => {
    renderPage();

    expect(await screen.findByText("Zelda: Tears of the Kingdom")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Options" })).toBeInTheDocument();
    expect(toolbarButton("Platform")).toBeInTheDocument();
    expect(toolbarButton("Format")).toBeInTheDocument();
    // The inline Platform/Format filter dropdowns are gone — the page's only
    // remaining combobox is the pagination footer.
    expect(screen.queryByRole("combobox", { name: "Platform" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Format" })).not.toBeInTheDocument();
  });

  it("filters by platform from its popout", async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText("Astro Bot")).toBeInTheDocument();
    await user.click(toolbarButton("Platform"));
    await user.click(await screen.findByRole("menuitem", { name: "Nintendo Switch" }));
    expect(await screen.findByText("Zelda: Tears of the Kingdom")).toBeInTheDocument();
    expect(screen.queryByText("Astro Bot")).not.toBeInTheDocument();
    expect(within(toolbarButton("Platform")).getByText("1")).toBeInTheDocument();
  });

  it("filters by format from its popout", async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText("Astro Bot")).toBeInTheDocument();
    await user.click(toolbarButton("Format"));
    await user.click(await screen.findByRole("menuitem", { name: "digital" }));
    expect(await screen.findByText("Zelda: Tears of the Kingdom")).toBeInTheDocument();
    expect(screen.queryByText("Astro Bot")).not.toBeInTheDocument();
  });

  it("changes rows per page from the options popout", async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText("Astro Bot")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Options" }));
    await user.click(await screen.findByRole("menuitem", { name: "25" }));
    // Reopen: the new choice carries the checkmark.
    await user.click(screen.getByRole("button", { name: "Options" }));
    expect(await screen.findByRole("menuitem", { name: "25" })).toHaveClass("Mui-selected");
  });
});
