import { fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GameAboutData } from "../../api/types";
import { createM3Theme } from "../../theme/createM3Theme";
import { StoreRegionProvider } from "../../theme/StoreRegionProvider";
import GameAboutSection from "../GameAboutSection";

const baseGame: GameAboutData = {
  name: "Sword Art Online: Fractured Daydream",
  category: "main_game",
  igdbId: 1,
  igdbUrl: null,
  firstReleaseDate: 1728000000,
  summary: null,
  storyline: null,
  edition: null,
  rating: null,
  parentGameId: null,
  parentGameName: null,
  parentGameSlug: null,
  parentGameUuid: null,
  displayParentGameId: null,
  displayParentGameName: null,
  displayParentGameSlug: null,
  displayParentGameUuid: null,
  externalParentName: null,
  externalParentIgdbUrl: null,
  genres: [],
  companies: [
    {
      id: 1,
      name: "Bandai Namco Entertainment",
      slug: "bandai-namco-entertainment",
      logoUrl: "https://example.com/bandai-logo.png",
      role: "publisher",
    },
    {
      id: 2,
      name: "Dimps",
      slug: "dimps",
      logoUrl: null,
      role: "developer",
    },
  ],
  franchises: [],
  collections: [],
  platforms: [
    {
      id: 1,
      igdbId: 130,
      name: "Nintendo Switch",
      slug: "switch",
      abbreviation: "Switch",
      spineTemplateUrl: null,
      caseHeightMm: null,
      caseSpineMm: null,
      spineColor: null,
      spineIcon: null,
      spineIconUrl: null,
      gameCount: 0,
    },
    {
      id: 2,
      igdbId: 167,
      name: "Sony Playstation 5",
      slug: "ps5",
      abbreviation: "PS5",
      spineTemplateUrl: null,
      caseHeightMm: null,
      caseSpineMm: null,
      spineColor: null,
      spineIcon: null,
      spineIconUrl: null,
      gameCount: 0,
    },
  ],
  screenshotUrls: [],
  artworkUrls: [],
  videos: [],
  releaseDates: [
    {
      id: 1,
      date: 1728000000,
      human: "Oct 04, 2024",
      platformName: "Nintendo Switch",
      releaseRegion: "worldwide",
    },
    {
      id: 2,
      date: 1727740800,
      human: "Oct 01, 2024",
      platformName: "Nintendo Switch",
      releaseRegion: "worldwide",
    },
  ],
  igdbStatus: null,
  gameModes: ["Single player", "Multiplayer"],
  ageRatings: {},
  timeToBeat: null,
  steamStoreUrl: null,
  xboxStoreUrl: null,
  playstationStoreUrl: null,
  nintendoStoreUrl: null,
  epicGamesStoreUrl: null,
  gogStoreUrl: null,
};

function renderSection(game: GameAboutData) {
  return render(
    <ThemeProvider theme={createM3Theme("light", "normal")}>
      <MemoryRouter>
        <StoreRegionProvider>
          <GameAboutSection game={game} />
        </StoreRegionProvider>
      </MemoryRouter>
    </ThemeProvider>
  );
}

// This test environment (Node 26 + jsdom) has no usable localStorage, so give the provider
// a small in-memory one.
function memoryStorage(): Storage {
  const items = new Map<string, string>();
  return {
    get length() {
      return items.size;
    },
    clear: () => items.clear(),
    getItem: (key) => items.get(key) ?? null,
    key: (index) => Array.from(items.keys())[index] ?? null,
    removeItem: (key) => void items.delete(key),
    setItem: (key, value) => void items.set(key, String(value)),
  };
}

describe("GameAboutSection platforms and companies", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", memoryStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows company names with no logo images", () => {
    const { container } = renderSection(baseGame);

    expect(screen.getByText(/Published by:/)).toBeInTheDocument();
    expect(screen.getByText(/Bandai Namco Entertainment/)).toBeInTheDocument();
    expect(screen.getByText(/Developed by:/)).toBeInTheDocument();
    expect(screen.getByText(/Dimps/)).toBeInTheDocument();
    // No store links, screenshots, or artwork in this fixture, so any img would be a
    // company logo — and the publisher's logo URL must not appear anywhere.
    expect(container.querySelectorAll("img")).toHaveLength(0);
    expect(container.querySelector('img[src="https://example.com/bandai-logo.png"]')).toBeNull();
  });

  it("collapses platforms and releases into Available Platforms below Game modes", () => {
    const { container } = renderSection(baseGame);
    const toggle = screen.getByRole("button", { name: "Available Platforms" });
    const gameModesLabel = screen.getByText("Game modes");

    // Below Game modes, not above it.
    expect(
      gameModesLabel.compareDocumentPosition(toggle) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    // Collapsed by default: the Collapse is in its exited state.
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(container.querySelector(".MuiCollapse-hidden")).not.toBeNull();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(container.querySelector(".MuiCollapse-hidden")).toBeNull();
    // Everything the old layout showed is still there once expanded.
    expect(
      screen.getByText("Available on: Nintendo Switch, Sony Playstation 5")
    ).toBeInTheDocument();
    expect(screen.getByText("Nintendo Switch: Oct 04, 2024 (Worldwide)")).toBeInTheDocument();
    expect(screen.getByText("Nintendo Switch: Oct 01, 2024 (Worldwide)")).toBeInTheDocument();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("renders no Available Platforms section without platforms or multiple releases", () => {
    renderSection({ ...baseGame, platforms: [], releaseDates: [] });

    expect(screen.queryByText("Available Platforms")).toBeNull();
  });

  it("still shows the section for a single release date when platforms exist", () => {
    renderSection({ ...baseGame, releaseDates: [baseGame.releaseDates[0]] });

    const toggle = screen.getByRole("button", { name: "Available Platforms" });
    fireEvent.click(toggle);
    expect(
      screen.getByText("Available on: Nintendo Switch, Sony Playstation 5")
    ).toBeInTheDocument();
  });
});
