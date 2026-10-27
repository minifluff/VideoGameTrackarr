import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { createM3Theme } from "../../theme/createM3Theme";
import DashboardPage from "../DashboardPage";

// Same wrapper as the Sidebar tests — production renders always go through the app's
// real createM3Theme. The dashboard queries have no server in jsdom, so they fail into
// their error state and the sections render with placeholder values; the tests below
// don't depend on live data.
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

describe("DashboardPage", () => {
  it("shows the upstream sections and a settings-gear menu with the page options", async () => {
    renderDashboard();
    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByText("Quick add")).toBeInTheDocument();
    expect(screen.getByText("Now playing")).toBeInTheDocument();
    expect(screen.getByText("Needs attention")).toBeInTheDocument();
    expect(screen.getByText("Nothing marked Playing yet.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(await screen.findByRole("menuitem", { name: "Add game" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Display Mode" })).toBeInTheDocument();
  });
});
