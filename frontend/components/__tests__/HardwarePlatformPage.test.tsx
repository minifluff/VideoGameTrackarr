import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import HardwarePlatformPage from "../HardwarePlatformPage";

let lookup: Record<string, { id: number; name: string } | undefined> = {};
let loading = false;
vi.mock("../../hooks/useHardwareLookups", () => ({
  useHardwarePlatformBySlug: (slug: string | undefined) => {
    const platform = slug ? lookup[slug] : undefined;
    return { platform, isLoading: loading, notFound: !loading && !platform };
  },
}));

// The lists themselves aren't what's under test here — just that the platform
// page hands HardwarePage the pinned platform.
vi.mock("../HardwarePage", () => ({
  default: ({ platformId, platformName }: { platformId?: number; platformName?: string }) => (
    <div>{`Hardware ${platformId} ${platformName}`}</div>
  ),
}));

function renderPage(slug: string) {
  return render(
    <MemoryRouter initialEntries={[`/hardware/platforms/${slug}`]}>
      <Routes>
        <Route path="/hardware/platforms/:platformSlug" element={<HardwarePlatformPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("HardwarePlatformPage", () => {
  beforeEach(() => {
    lookup = { "playstation-5": { id: 7, name: "PlayStation 5" } };
    loading = false;
  });

  it("renders the Hardware lists pinned to the platform", () => {
    renderPage("playstation-5");

    expect(screen.getByText("Hardware 7 PlayStation 5")).toBeInTheDocument();
  });

  it("shows the loading state while the platforms load", () => {
    loading = true;
    renderPage("playstation-5");

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("shows the not-found page for an unknown slug", () => {
    renderPage("atari-jaguar");

    expect(screen.getByText("Platform not found")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back to Platforms" })).toBeInTheDocument();
  });
});
