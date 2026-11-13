import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import SyncPage from "../SyncPage";

// The panels are heavy pages with their own hooks — stub them; what matters
// here is the tab switching and the ?tab= deep link.
vi.mock("../SteamSyncPage", () => ({ default: () => <div>Steam panel</div> }));
vi.mock("../GogSyncPage", () => ({ default: () => <div>GOG panel</div> }));

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
};

function renderSync(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/settings/sync" element={<SyncPage />} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>
  );
}

describe("SyncPage", () => {
  it("shows the Steam tab by default, with an Integration Sync heading", () => {
    renderSync("/settings/sync");

    expect(screen.getByRole("heading", { name: "Integration Sync" })).toBeInTheDocument();
    expect(screen.getByText("Steam panel")).toBeInTheDocument();
    expect(screen.queryByText("GOG panel")).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Steam Sync" })).toHaveAttribute("aria-selected", "true");
  });

  it("switches to the GOG tab on click and writes ?tab=gog to the URL", async () => {
    const user = userEvent.setup();
    renderSync("/settings/sync");

    await user.click(screen.getByRole("tab", { name: "GOG Sync" }));

    expect(screen.getByText("GOG panel")).toBeInTheDocument();
    expect(screen.queryByText("Steam panel")).not.toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/settings/sync?tab=gog");
  });

  it("opens on the GOG tab for ?tab=gog", () => {
    renderSync("/settings/sync?tab=gog");

    expect(screen.getByText("GOG panel")).toBeInTheDocument();
    expect(screen.queryByText("Steam panel")).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "GOG Sync" })).toHaveAttribute("aria-selected", "true");
  });
});
