import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { createM3Theme } from "../../theme/createM3Theme";
import DashboardPage from "../DashboardPage";

// The combined section needs a share link to exist, like the standalone
// Public Collection button; the dashboard queries otherwise have no server
// in jsdom and fail into their placeholder state, which is all these tests
// depend on.
vi.mock("../../hooks/useShareLink", () => ({
  useShareLink: () => ({ data: "test-token" }),
}));

const theme = createM3Theme("light", "normal");

function renderDashboard() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <MemoryRouter initialEntries={["/"]}>
          <DashboardPage />
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

describe("DashboardPage combined Display Mode + Public Collection section", () => {
  it("keeps both standalone buttons and adds the pair side by side", async () => {
    renderDashboard();
    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    // The heading renders during load now, so wait for a section before
    // asserting the loaded buttons.
    expect(await screen.findByText("Quick add")).toBeInTheDocument();

    // Two of each: the standalone buttons plus the combined section's pair.
    const displayButtons = screen.getAllByRole("button", { name: "Display Mode" });
    expect(displayButtons).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Public Game Collection" })).toHaveLength(2);

    // The combined section is last in the default layout, so its Display Mode
    // button is the second one — and it shares its row with the section's
    // Public Game Collection button.
    const combinedRow = displayButtons[1].parentElement!;
    expect(within(combinedRow).getByRole("button", { name: "Public Game Collection" })).toBeInTheDocument();
  });

  it("lists the combined section in the Customize dialog", async () => {
    renderDashboard();
    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Customize" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Display Mode & Public Collection")).toBeInTheDocument();
  });
});
