import { fireEvent, render, screen, type RenderResult } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "@mui/material/styles";
import { describe, expect, it, vi } from "vitest";
import { createM3Theme } from "../../theme/createM3Theme";
import GameCard, { type GameCardGame } from "../GameCard";

const baseGame: GameCardGame = {
  name: "Hollow Knight",
  firstReleaseDate: 1_456_704_000,
  coverUrl: null,
  category: "main_game",
};

// GameCard reads M3-specific theme roles (theme.palette.m3, theme.m3Shape) that only
// exist once wrapped in the app's real createM3Theme — the default MUI theme used by
// render() otherwise doesn't have them, which is what every production render goes
// through (see ColorModeProvider.tsx).
const theme = createM3Theme("light", "normal");
function renderWithTheme(ui: React.ReactElement): RenderResult {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

describe("GameCard", () => {
  it("shows a 'No cover' placeholder when there's no cover image", () => {
    renderWithTheme(<GameCard game={baseGame} context="list" contextFunction={vi.fn()} />);

    expect(screen.getByText("No cover")).toBeInTheDocument();
  });

  it("renders the cover image when one exists, with no placeholder text", () => {
    renderWithTheme(
      <GameCard
        game={{ ...baseGame, coverUrl: "https://images.igdb.com/cover.jpg" }}
        context="list"
        contextFunction={vi.fn()}
      />
    );

    expect(screen.queryByText("No cover")).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Hollow Knight/ })).toHaveAttribute(
      "src",
      "https://images.igdb.com/cover.jpg"
    );
    // Covers decode off the main thread so a row of them loading at once
    // doesn't jank a slow device.
    expect(screen.getByRole("img", { name: /Hollow Knight/ })).toHaveAttribute(
      "decoding",
      "async"
    );
  });

  it("shows the 'No cover' placeholder when the cover image fails to load", () => {
    renderWithTheme(
      <GameCard
        game={{ ...baseGame, coverUrl: "https://images.igdb.com/cover.jpg" }}
        context="list"
        contextFunction={vi.fn()}
      />
    );

    fireEvent.error(screen.getByRole("img", { name: /Hollow Knight/ }));
    expect(screen.getByText("No cover")).toBeInTheDocument();
  });

  it("shows the wishlist and owned badges in list context", () => {
    const { container } = renderWithTheme(
      <GameCard
        game={{ ...baseGame, owned: true, wishlisted: true }}
        context="list"
        contextFunction={vi.fn()}
      />
    );

    // Queried by aria-label, not MUI's data-testid - the latter is stripped in production
    // builds (NODE_ENV=production), so a test relying on it would pass here but not
    // reflect what the e2e suite (running against a real production build) actually sees.
    expect(container.querySelector('svg[aria-label="On your wishlist"]')).not.toBeNull();
    expect(container.querySelector('svg[aria-label="In your collection"]')).not.toBeNull();
  });

  it("hides badges while in selectable mode, even if owned/wishlisted", () => {
    const { container } = renderWithTheme(
      <GameCard
        game={{ ...baseGame, owned: true, wishlisted: true }}
        context="list"
        contextFunction={vi.fn()}
        selectable
        selected={false}
        onToggleSelect={vi.fn()}
      />
    );

    expect(container.querySelector('svg[aria-label="On your wishlist"]')).toBeNull();
    expect(container.querySelector('svg[aria-label="In your collection"]')).toBeNull();
  });

  it("shows an On Sale chip when isOnSale is true in list context", () => {
    renderWithTheme(
      <GameCard game={{ ...baseGame, isOnSale: true }} context="list" contextFunction={vi.fn()} />
    );

    expect(screen.getByText("On Sale")).toBeInTheDocument();
  });

  it("does not show an On Sale chip when isOnSale is false or unset", () => {
    renderWithTheme(<GameCard game={baseGame} context="list" contextFunction={vi.fn()} />);

    expect(screen.queryByText("On Sale")).not.toBeInTheDocument();
  });

  it("hides the On Sale chip while in selectable mode, even if isOnSale is true", () => {
    renderWithTheme(
      <GameCard
        game={{ ...baseGame, isOnSale: true }}
        context="list"
        contextFunction={vi.fn()}
        selectable
        selected={false}
        onToggleSelect={vi.fn()}
      />
    );

    expect(screen.queryByText("On Sale")).not.toBeInTheDocument();
  });

  it("shows a play status chip when set to something other than 'none'", () => {
    renderWithTheme(
      <GameCard
        game={{ ...baseGame, playStatus: "playing" }}
        context="list"
        contextFunction={vi.fn()}
      />
    );

    expect(screen.getByText("Playing")).toBeInTheDocument();
  });

  it("calls contextFunction when the cover is clicked in list context", async () => {
    const contextFunction = vi.fn();
    renderWithTheme(
      <GameCard
        game={{ ...baseGame, coverUrl: "https://images.igdb.com/cover.jpg" }}
        context="list"
        contextFunction={contextFunction}
      />
    );

    await userEvent.click(screen.getByRole("img", { name: /Hollow Knight/ }));

    expect(contextFunction).toHaveBeenCalledOnce();
  });

  it("in public context, clicking the cover opens the game only when contextFunction is passed", async () => {
    const contextFunction = vi.fn();
    const game = { ...baseGame, coverUrl: "https://images.igdb.com/cover.jpg" };
    const { unmount } = renderWithTheme(<GameCard game={game} context="public" />);
    await userEvent.click(screen.getByRole("img", { name: /Hollow Knight/ }));
    unmount();

    renderWithTheme(<GameCard game={game} context="public" contextFunction={contextFunction} />);
    await userEvent.click(screen.getByRole("img", { name: /Hollow Knight/ }));

    expect(contextFunction).toHaveBeenCalledOnce();
  });

  it("in selectable mode, clicking the card toggles selection instead of calling contextFunction", async () => {
    const contextFunction = vi.fn();
    const onToggleSelect = vi.fn();
    renderWithTheme(
      <GameCard
        game={baseGame}
        context="list"
        contextFunction={contextFunction}
        selectable
        selected={false}
        onToggleSelect={onToggleSelect}
      />
    );

    await userEvent.click(screen.getByText("No cover"));

    expect(onToggleSelect).toHaveBeenCalledOnce();
    expect(contextFunction).not.toHaveBeenCalled();
  });

  it("greyscales the cover when neither owned nor wishlisted, regardless of autoDiscovered", () => {
    renderWithTheme(
      <GameCard
        game={{ ...baseGame, coverUrl: "https://images.igdb.com/cover.jpg", owned: false, wishlisted: false }}
        context="list"
        contextFunction={vi.fn()}
      />
    );

    expect(screen.getByRole("img", { name: /Hollow Knight/ })).toHaveStyle({ filter: "grayscale(1)" });
  });

  it("does not greyscale the cover once owned or wishlisted", () => {
    renderWithTheme(
      <GameCard
        game={{ ...baseGame, coverUrl: "https://images.igdb.com/cover.jpg", owned: true, wishlisted: false }}
        context="list"
        contextFunction={vi.fn()}
      />
    );

    expect(screen.getByRole("img", { name: /Hollow Knight/ })).toHaveStyle({ filter: "none" });
  });

  it("shows a Missing chip only for a still-unclaimed 'what's missing' discovery", () => {
    renderWithTheme(
      <GameCard
        game={{ ...baseGame, owned: false, wishlisted: false, autoDiscovered: true }}
        context="list"
        contextFunction={vi.fn()}
      />
    );

    expect(screen.getByText("Missing")).toBeInTheDocument();
  });

  it("does not show a Missing chip for a manually-added game that just isn't owned/wishlisted yet", () => {
    renderWithTheme(
      <GameCard
        game={{ ...baseGame, owned: false, wishlisted: false, autoDiscovered: false }}
        context="list"
        contextFunction={vi.fn()}
      />
    );

    expect(screen.queryByText("Missing")).not.toBeInTheDocument();
  });

  it("does not show a Missing chip once a discovered game is owned or wishlisted", () => {
    renderWithTheme(
      <GameCard
        game={{ ...baseGame, owned: true, wishlisted: false, autoDiscovered: true }}
        context="list"
        contextFunction={vi.fn()}
      />
    );

    expect(screen.queryByText("Missing")).not.toBeInTheDocument();
  });

  it("shows a Custom chip for a manually-added game with no IGDB id", () => {
    renderWithTheme(
      <GameCard
        game={{ ...baseGame, owned: false, wishlisted: false, autoDiscovered: false, igdbId: null }}
        context="list"
        contextFunction={vi.fn()}
      />
    );

    expect(screen.getByText("Custom")).toBeInTheDocument();
  });

  it("does not show a Custom chip when the game has an IGDB id", () => {
    renderWithTheme(
      <GameCard
        game={{ ...baseGame, owned: false, wishlisted: false, autoDiscovered: false, igdbId: 123 }}
        context="list"
        contextFunction={vi.fn()}
      />
    );

    expect(screen.queryByText("Custom")).not.toBeInTheDocument();
  });

  it("shows Missing, not Custom, for an unclaimed discovery even without an IGDB id", () => {
    renderWithTheme(
      <GameCard
        game={{ ...baseGame, owned: false, wishlisted: false, autoDiscovered: true, igdbId: null }}
        context="list"
        contextFunction={vi.fn()}
      />
    );

    expect(screen.getByText("Missing")).toBeInTheDocument();
    expect(screen.queryByText("Custom")).not.toBeInTheDocument();
  });

  it("shows the full release date with dateFormat full, and just the year by default", () => {
    const { unmount } = renderWithTheme(
      <GameCard game={baseGame} context="list" contextFunction={vi.fn()} dateFormat="full" />
    );

    expect(screen.getByText("Feb 29, 2016")).toBeInTheDocument();
    unmount();

    renderWithTheme(<GameCard game={baseGame} context="list" contextFunction={vi.fn()} />);

    expect(screen.getByText("2016")).toBeInTheDocument();
    expect(screen.queryByText("Feb 29, 2016")).not.toBeInTheDocument();
  });

  it("shows the addon type label for non-main_game categories", () => {
    renderWithTheme(
      <GameCard
        game={{ ...baseGame, category: "dlc_addon" }}
        context="addon"
        contextFunction={vi.fn()}
      />
    );

    expect(screen.getByText("DLC")).toBeInTheDocument();
  });

  it("in add context, clicking the cover opens the result while the Add button still adds", async () => {
    const onOpen = vi.fn();
    const onAdd = vi.fn();
    renderWithTheme(
      <GameCard
        game={{ ...baseGame, coverUrl: "https://images.igdb.com/cover.jpg" }}
        context="add"
        contextFunction={onAdd}
        onOpen={onOpen}
      />
    );

    await userEvent.click(screen.getByRole("img", { name: /Hollow Knight/ }));
    expect(onOpen).toHaveBeenCalledOnce();
    expect(onAdd).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(onAdd).toHaveBeenCalledOnce();
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("shows owned platforms as one line, with a +N count past three", () => {
    renderWithTheme(
      <GameCard
        game={baseGame}
        context="list"
        contextFunction={vi.fn()}
        ownedPlatforms={["PS4", "Steam", "Xbox One", "Switch", "PC"]}
      />
    );

    expect(screen.getByText("PS4 · Steam · Xbox One +2")).toBeInTheDocument();
  });

  it("shows 'Wishlisted' instead of platforms for a wishlisted game with none owned", () => {
    renderWithTheme(
      <GameCard
        game={{ ...baseGame, owned: false, wishlisted: true }}
        context="list"
        contextFunction={vi.fn()}
        ownedPlatforms={[]}
      />
    );

    expect(screen.getByText("Wishlisted")).toBeInTheDocument();
  });

  it("prefers owned platforms over 'Wishlisted' when the game has both", () => {
    renderWithTheme(
      <GameCard
        game={{ ...baseGame, owned: true, wishlisted: true }}
        context="list"
        contextFunction={vi.fn()}
        ownedPlatforms={["PS4"]}
      />
    );

    expect(screen.getByText("PS4")).toBeInTheDocument();
    expect(screen.queryByText("Wishlisted")).not.toBeInTheDocument();
  });

  it("shows no platform line when the game is owned on no platform", () => {
    renderWithTheme(
      <GameCard game={baseGame} context="list" contextFunction={vi.fn()} ownedPlatforms={[]} />
    );

    expect(screen.queryByText(/PS4/)).not.toBeInTheDocument();
  });

  it("reserves the play-status slot on a wishlisted game, so its row lines up with owned cards", () => {
    const { container } = renderWithTheme(
      <GameCard
        game={{ ...baseGame, owned: false, wishlisted: true }}
        context="list"
        contextFunction={vi.fn()}
        ownedPlatforms={[]}
      />
    );

    // The Wishlisted line fills the platform row, so the reserved slot below it
    // matches owned cards — without it the wishlist card dangles a row short.
    expect(container.querySelectorAll(".MuiChip-root")).toHaveLength(1);
  });

  it("reserves no play-status slot on a game that is neither owned nor wishlisted", () => {
    const { container } = renderWithTheme(
      <GameCard
        game={{ ...baseGame, owned: false, wishlisted: false }}
        context="list"
        contextFunction={vi.fn()}
        ownedPlatforms={[]}
      />
    );

    // No platforms/Wishlisted line either, so the slot would sit directly under
    // the year looking like a blank platform row.
    expect(container.querySelectorAll(".MuiChip-root")).toHaveLength(0);
  });

  it("still reserves the play-status slot on an owned game without a status", () => {
    const { container } = renderWithTheme(
      <GameCard
        game={{ ...baseGame, owned: true }}
        context="list"
        contextFunction={vi.fn()}
        ownedPlatforms={["PS4"]}
      />
    );

    expect(container.querySelectorAll(".MuiChip-root")).toHaveLength(1);
  });

  it("in add context without onOpen, clicking the cover does nothing (existing pickers)", async () => {
    const onAdd = vi.fn();
    renderWithTheme(
      <GameCard
        game={{ ...baseGame, coverUrl: "https://images.igdb.com/cover.jpg" }}
        context="add"
        contextFunction={onAdd}
      />
    );

    await userEvent.click(screen.getByRole("img", { name: /Hollow Knight/ }));
    expect(onAdd).not.toHaveBeenCalled();
  });
});
