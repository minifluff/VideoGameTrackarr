import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitForElementToBeRemoved, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, MemoryRouter, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { PublicAccessorySummary, PublicDeviceSummary } from "../../api/types";
import PublicHardwarePage from "../PublicHardwarePage";

// jsdom doesn't implement ResizeObserver — VirtualGameGrid needs it once the
// device/accessory lists render.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("ResizeObserver", ResizeObserverStub);

const devices: PublicDeviceSummary[] = [
  {
    id: 1,
    officialName: "Zelda Controller",
    manufacturerName: "Nintendo",
    hardwarePlatformName: "Nintendo Switch",
    imageUrl: null,
    owned: true,
    wishlisted: false,
    ownedQuantity: 1,
  },
  {
    id: 2,
    officialName: "Astro Pad",
    manufacturerName: "Sony",
    hardwarePlatformName: "PlayStation 5",
    imageUrl: null,
    owned: false,
    wishlisted: true,
    ownedQuantity: 0,
  },
];

const accessories: PublicAccessorySummary[] = [
  {
    id: 3,
    officialName: "Zelda Case",
    manufacturerName: "Nintendo",
    imageUrl: null,
    owned: true,
    wishlisted: false,
    ownedQuantity: 1,
  },
];

vi.mock("../../hooks/usePublic", () => ({
  usePublicDevices: () => ({ data: devices, isLoading: false }),
  usePublicAccessories: () => ({ data: accessories, isLoading: false }),
}));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/public/test-token/hardware"]}>
        <Routes>
          <Route path="/public/:token/hardware" element={<PublicHardwarePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("PublicHardwarePage toolbar", () => {
  it("shows the Sort and Filters buttons next to the search field", async () => {
    renderPage();

    expect(await screen.findByText("Astro Pad")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sort by" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Filters" })).toBeInTheDocument();
  });

  it("sorts by name descending from the sort popout", async () => {
    const user = userEvent.setup();
    renderPage();

    const astro = await screen.findByText("Astro Pad");
    const zelda = screen.getByText("Zelda Controller");
    // Default is Name ascending: Astro Pad first.
    expect(astro.compareDocumentPosition(zelda) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Sort by" }));
    await user.click(await screen.findByRole("menuitem", { name: "Name (Descending)" }));

    const astroAfter = await screen.findByText("Astro Pad");
    const zeldaAfter = screen.getByText("Zelda Controller");
    expect(zeldaAfter.compareDocumentPosition(astroAfter) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("filters to owned items from the filters dialog, with a badge on the button", async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText("Astro Pad")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Filters" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Owned" }));

    expect(await screen.findByText("Zelda Controller")).toBeInTheDocument();
    expect(screen.queryByText("Astro Pad")).not.toBeInTheDocument();
    // The dialog stays open after a chip tap, and a modal hides the page
    // behind it from role queries — close it and wait out its exit transition
    // before reading the badge.
    await user.keyboard("{Escape}");
    await waitForElementToBeRemoved(() => screen.queryByRole("dialog"));
    expect(within(screen.getByRole("button", { name: "Filters" })).getByText("1")).toBeInTheDocument();
  });

  it("filters by manufacturer from the filters dialog", async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText("Astro Pad")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Filters" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("combobox", { name: "Manufacturer" }));
    await user.click(await screen.findByRole("option", { name: "Nintendo" }));

    expect(await screen.findByText("Zelda Controller")).toBeInTheDocument();
    expect(screen.queryByText("Astro Pad")).not.toBeInTheDocument();
  });
});
