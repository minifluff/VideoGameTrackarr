import { render, screen, type RenderResult } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { OnSaleItem } from "../../api/types";
import { createM3Theme } from "../../theme/createM3Theme";
import OnSaleTeaserSection from "../OnSaleTeaserSection";

// The teaser shows every on-sale game — there is no cap (the old 15-item
// TEASER_LIMIT was removed), so the mock holds 20 items and all 20 must render.
let mockItems: OnSaleItem[] = [];

vi.mock("../../hooks/useInsights", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../hooks/useInsights")>()),
  useOnSale: () => ({ data: mockItems }),
}));

const theme = createM3Theme("light", "normal");
function renderWithTheme(ui: React.ReactElement): RenderResult {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>{ui}</MemoryRouter>
    </ThemeProvider>
  );
}

function makeItem(index: number): OnSaleItem {
  return {
    libraryItemId: index + 1,
    game: {
      id: index + 1,
      uuid: `00000000-0000-0000-0000-0000000000${String(index + 1).padStart(2, "0")}`,
      name: `Sale Game ${index}`,
      slug: `sale-game-${index}`,
      coverUrl: null,
      category: "main_game",
      firstReleaseDate: 1_470_528_000,
      owned: false,
      wishlisted: true,
      autoDiscovered: false,
    },
    currentPriceAmount: 9.99,
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
}

describe("OnSaleTeaserSection", () => {
  it("shows every on-sale game, with no cap", () => {
    mockItems = Array.from({ length: 20 }, (_, index) => makeItem(index));

    renderWithTheme(<OnSaleTeaserSection />);

    for (let index = 0; index < 20; index += 1) {
      expect(screen.getByText(`Sale Game ${index}`)).toBeInTheDocument();
    }
  });

  it("renders nothing when nothing is on sale", () => {
    mockItems = [];

    const { container } = renderWithTheme(<OnSaleTeaserSection />);

    expect(container).toBeEmptyDOMElement();
  });
});
