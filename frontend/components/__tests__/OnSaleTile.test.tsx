import { render, screen, type RenderResult } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { OnSaleItem } from "../../api/types";
import { createM3Theme } from "../../theme/createM3Theme";
import { OnSaleTile } from "../OnSaleSection";

// Same M3-theme wrapper as the GameCard tests — GameCard reads theme.palette.m3 roles
// that only exist on the app's real createM3Theme.
const theme = createM3Theme("light", "normal");
function renderWithTheme(ui: React.ReactElement): RenderResult {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>{ui}</MemoryRouter>
    </ThemeProvider>
  );
}

const baseItem: OnSaleItem = {
  libraryItemId: 1,
  game: {
    id: 1,
    uuid: "00000000-0000-0000-0000-000000000001",
    name: "No Man's Sky",
    slug: "no-mans-sky",
    coverUrl: null,
    category: "main_game",
    firstReleaseDate: 1_470_528_000,
    owned: false,
    wishlisted: true,
    autoDiscovered: false,
  },
  currentPriceAmount: 31.19,
  currentPriceCurrency: "CAD",
  currentShopName: "Steam",
  currentCut: 50,
  historicalLowAmount: null,
  historicalLowCurrency: null,
  historicalLowShopName: null,
  historicalLowAt: null,
  targetPrice: null,
  isTargetHit: false,
};

describe("OnSaleTile", () => {
  it("shows 'Wishlisted' by default — the tile forces wishlisted on its card", () => {
    renderWithTheme(<OnSaleTile item={baseItem} />);

    expect(screen.getByText("Wishlisted")).toBeInTheDocument();
  });

  it("hides 'Wishlisted' when hideWishlistedLine is set, as the dashboard teaser does", () => {
    renderWithTheme(<OnSaleTile item={baseItem} hideWishlistedLine />);

    expect(screen.queryByText("Wishlisted")).not.toBeInTheDocument();
  });
});
