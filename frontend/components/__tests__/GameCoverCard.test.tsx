import { fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { describe, expect, it } from "vitest";
import { createM3Theme } from "../../theme/createM3Theme";
import GameCoverCard from "../GameCoverCard";

// Same M3-theme wrapper as GameCard's tests — production renders always go through
// the app's real createM3Theme.
const theme = createM3Theme("light", "normal");

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
});
