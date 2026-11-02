import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@mui/material/styles";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { DuplicateLibraryItemGroup, IgnoredDuplicateGroup } from "../../api/types";
import { createM3Theme } from "../../theme/createM3Theme";
import DuplicateLibraryItemsSection from "../DuplicateLibraryItemsSection";

vi.mock("react-toastify", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), dismiss: vi.fn() },
}));

let groups: DuplicateLibraryItemGroup[] = [];
let ignored: IgnoredDuplicateGroup[] = [];
const ignoreGroup = vi.fn();
const unignoreGroup = vi.fn();

vi.mock("../../hooks/useInsights", () => ({
  useDuplicateLibraryItems: () => ({ data: groups }),
  useIgnoredDuplicateLibraryItems: () => ({ data: ignored }),
  useIgnoreDuplicateLibraryItems: () => ({ mutateAsync: ignoreGroup, isPending: false }),
  useUnignoreDuplicateLibraryItems: () => ({ mutateAsync: unignoreGroup, isPending: false }),
}));

function item(id: number) {
  return {
    id,
    gameId: 7,
    platformId: 3,
    platformName: "Switch",
    platformSlug: "switch",
    regionId: 5,
    regionName: "North America",
    status: "owned",
    format: null,
    digitalStorefront: null,
    ratingBoard: null,
    edition: null,
    price: null,
    targetPrice: null,
    trackForSales: false,
    acquiredAt: null,
    notes: null,
    steelbook: false,
    isOnSale: false,
    salePriceAmount: null,
    salePriceCurrency: null,
    saleShopName: null,
    saleCut: null,
    roms: [],
  };
}

function renderSection() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={createM3Theme("light", "normal")}>
        <MemoryRouter>
          <DuplicateLibraryItemsSection />
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

describe("DuplicateLibraryItemsSection ignore", { timeout: 20_000 }, () => {
  it("ignores a group with the first item's grouping key", async () => {
    groups = [
      {
        gameId: 7,
        gameName: "Zelda",
        gameSlug: "zelda",
        gameUuid: "uuid-7",
        items: [item(1), item(2)],
      } as unknown as DuplicateLibraryItemGroup,
    ];
    ignored = [];
    ignoreGroup.mockResolvedValue({});
    renderSection();

    fireEvent.click(screen.getByRole("button", { name: "Ignore this duplicate group" }));

    await waitFor(() =>
      expect(ignoreGroup).toHaveBeenCalledWith({
        gameId: 7,
        status: "owned",
        platformId: 3,
        regionId: 5,
        format: null,
        edition: null,
      })
    );
  });

  it("shows ignored groups with an unignore button behind the toggle", async () => {
    groups = [];
    ignored = [
      {
        id: 9,
        gameId: 7,
        gameName: "Zelda",
        gameSlug: "zelda",
        gameUuid: "uuid-7",
        status: "owned",
        platformId: 3,
        platformName: "Switch",
        regionId: 5,
        regionName: "North America",
        format: null,
        edition: null,
      } as unknown as IgnoredDuplicateGroup,
    ];
    unignoreGroup.mockResolvedValue(undefined);
    renderSection();

    expect(screen.queryByText("Ignored duplicate groups")).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Show ignored"));

    expect(screen.getByText("Ignored duplicate groups")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Stop ignoring this duplicate group" }));

    await waitFor(() => expect(unignoreGroup).toHaveBeenCalledWith(9));
  });
});
