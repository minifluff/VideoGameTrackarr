import { fireEvent, render, screen, waitFor, within, type RenderResult } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { describe, expect, it } from "vitest";
import { createM3Theme } from "../../theme/createM3Theme";
import GameCoverCard from "../GameCoverCard";

// Same M3-theme wrapper as GameCard's tests — production renders always go through
// the app's real createM3Theme.
const theme = createM3Theme("light", "normal");
function renderWithTheme(ui: React.ReactElement): RenderResult {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

const game = {
  name: "Hollow Knight",
  coverUrl: "https://images.igdb.com/igdb/image/upload/t_720p/abc.jpg",
  owned: true,
  wishlisted: false,
  isOnSale: false,
  autoDiscovered: false,
};

describe("GameCoverCard", () => {
  it("falls back to the no-image placeholder when the cover fails to load", () => {
    render(
      <ThemeProvider theme={theme}>
        <GameCoverCard
          game={{
            name: "Hollow Knight",
            coverUrl: "https://images.igdb.com/cover.jpg",
            owned: true,
            wishlisted: false,
            isOnSale: false,
            autoDiscovered: false,
          }}
        />
      </ThemeProvider>
    );

    fireEvent.error(screen.getByRole("img", { name: /Hollow Knight/ }));
    expect(screen.getByText("No Image Available")).toBeInTheDocument();
  });

  it("opens the cover fullscreen on click, at the larger IGDB size", () => {
    renderWithTheme(<GameCoverCard game={game} />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("img", { name: "Hollow Knight" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("img", { name: "Hollow Knight" })).toHaveAttribute(
      "src",
      "https://images.igdb.com/igdb/image/upload/t_1080p/abc.jpg"
    );
  });

  it("closes the fullscreen view from the close button and from clicking the image", async () => {
    renderWithTheme(<GameCoverCard game={game} />);
    fireEvent.click(screen.getByRole("img", { name: "Hollow Knight" }));

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    // The dialog leaves on its exit transition, so it unmounts a beat after the click.
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole("img", { name: "Hollow Knight" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("img", { name: "Hollow Knight" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("does not open a fullscreen view when there is no cover", () => {
    renderWithTheme(<GameCoverCard game={{ ...game, coverUrl: null }} />);

    expect(screen.getByText("No Image Available")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
