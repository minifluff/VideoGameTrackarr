import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
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
  it("shows the upstream sections with restored buttons and a Customize dialog", async () => {
    renderDashboard();
    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    // The heading renders during load now (the header sits outside the
    // skeleton gate), so wait for a section before asserting loaded content.
    expect(await screen.findByText("Quick add")).toBeInTheDocument();
    expect(screen.getByText("Now playing")).toBeInTheDocument();
    expect(screen.getByText("Needs attention")).toBeInTheDocument();
    expect(screen.getByText("Nothing marked Playing yet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add game" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Display Mode" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Customize" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Customize Overview")).toBeInTheDocument();
    expect(within(dialog).getByRole("slider", { name: "Game card size" })).toBeInTheDocument();
    expect(within(dialog).getByText("Summary tiles")).toBeInTheDocument();
    // "Quick add" also names the page section, so the row is scoped to the dialog.
    expect(within(dialog).getByText("Quick add")).toBeInTheDocument();
    // The two dashboard buttons are layout entries too, so they get dialog rows;
    // "Display Mode" also names the page button, so it is scoped to the dialog.
    expect(within(dialog).getByText("Display Mode")).toBeInTheDocument();
    expect(within(dialog).getByText("Public Game Collection")).toBeInTheDocument();
  });
});
