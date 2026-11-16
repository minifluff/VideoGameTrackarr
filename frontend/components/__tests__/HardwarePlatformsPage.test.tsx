import type { ReactNode } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useParams } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LibraryHardwarePlatform } from "../../api/types";
import HardwarePlatformsPage from "../HardwarePlatformsPage";

let platforms: LibraryHardwarePlatform[] = [];
vi.mock("../../hooks/useHardwareLookups", () => ({
  useLibraryHardwarePlatforms: () => ({ data: platforms, isLoading: false }),
}));

// Pretend only ps5.png has been dropped into assets/platforms/ — the card asks
// hardwarePlatformLogoUrl for the logo, so stub that (the name-to-slug mapping
// itself is covered by utils/__tests__/platformLogos.test.ts).
vi.mock("../../utils/platformLogos", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../utils/platformLogos")>();
  return {
    ...actual,
    hardwarePlatformLogoUrl: (name: string) => (name === "PlayStation 5" ? "/assets/ps5.png" : undefined),
  };
});

// Render every card plainly — virtualisation isn't what's under test here.
vi.mock("../VirtualGameGrid", () => ({
  default: <T,>({
    items,
    getKey,
    renderItem,
  }: {
    items: T[];
    getKey: (item: T) => number;
    renderItem: (item: T) => ReactNode;
  }) => (
    <div>
      {items.map((item) => (
        <div key={getKey(item)} data-testid="grid-item">
          {renderItem(item)}
        </div>
      ))}
    </div>
  ),
}));

function platform(
  id: number,
  name: string,
  devices: number,
  accessories: number,
  owned = devices + accessories,
  wishlisted = 0,
): LibraryHardwarePlatform {
  return { id, name, deviceCount: devices, accessoryCount: accessories, ownedCount: owned, wishlistedCount: wishlisted };
}

const PlatformParam = () => {
  const { platformSlug } = useParams();
  return <div>{`Platform page ${platformSlug}`}</div>;
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/hardware/platforms"]}>
      <Routes>
        <Route path="/hardware/platforms" element={<HardwarePlatformsPage />} />
        <Route path="/hardware/platforms/:platformSlug" element={<PlatformParam />} />
      </Routes>
    </MemoryRouter>
  );
}

const cardNames = () => screen.getAllByTestId("grid-item").map((item) => within(item).getByTitle(/./).textContent);

describe("HardwarePlatformsPage", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    localStorage.clear();
    platforms = [
      platform(1, "PlayStation 5", 2, 2),
      platform(2, "Nintendo Switch", 0, 3),
      platform(3, "Atari Jaguar", 1, 0),
    ];
  });

  it("shows the logo when there is one, and the name otherwise", () => {
    renderPage();

    const ps5Card = screen.getByTitle("PlayStation 5").closest("[data-testid=grid-item]") as HTMLElement;
    expect(ps5Card.querySelector("img")).toHaveAttribute("src", "/assets/ps5.png");
    const switchCard = screen.getByTitle("Nintendo Switch").closest("[data-testid=grid-item]") as HTMLElement;
    expect(switchCard.querySelector("img")).toBeNull();
    // The badge is the name itself (unlike Games → Platforms' abbreviation), so
    // pick it out by its aria-hidden marker rather than by text.
    expect(switchCard.querySelector('[aria-hidden="true"]')).toHaveTextContent("Nintendo Switch");
  });

  it("shows device and accessory counts", () => {
    renderPage();

    const ps5Card = screen.getByTitle("PlayStation 5").closest("[data-testid=grid-item]") as HTMLElement;
    expect(within(ps5Card).getByText("2 devices")).toBeInTheDocument();
    expect(within(ps5Card).getByText("2 accessories")).toBeInTheDocument();
    const switchCard = screen.getByTitle("Nintendo Switch").closest("[data-testid=grid-item]") as HTMLElement;
    expect(within(switchCard).getByText("0 devices")).toBeInTheDocument();
    expect(within(switchCard).getByText("3 accessories")).toBeInTheDocument();
  });

  it("sorts by name by default", () => {
    renderPage();

    expect(cardNames()).toEqual(["Atari Jaguar", "Nintendo Switch", "PlayStation 5"]);
  });

  it("sorts by most hardware (devices plus accessories)", () => {
    window.sessionStorage.setItem("vgt.view.hardwarePlatforms.sort", JSON.stringify("count_desc"));
    renderPage();

    expect(cardNames()).toEqual(["PlayStation 5", "Nintendo Switch", "Atari Jaguar"]);
  });

  it("links by slug", () => {
    renderPage();

    fireEvent.click(screen.getByTitle("PlayStation 5"));

    expect(screen.getByText("Platform page playstation-5")).toBeInTheDocument();
  });

  it("shows the empty message when there are no platforms", () => {
    platforms = [];
    renderPage();

    expect(screen.getByText(/No platforms yet/)).toBeInTheDocument();
  });
});
