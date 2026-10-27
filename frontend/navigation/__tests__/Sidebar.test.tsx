import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { createM3Theme } from "../../theme/createM3Theme";
import Sidebar from "../Sidebar";

// Same M3-theme wrapper as the card tests — production renders always go through
// the app's real createM3Theme. Stats/version queries have no server in jsdom, so
// they fail into their error state and the count badges simply stay hidden; the
// tests below don't depend on them.
const theme = createM3Theme("light", "normal");

function renderSidebar(initialPath: string, onNavigate = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <MemoryRouter initialEntries={[initialPath]}>
          <Sidebar onNavigate={onNavigate} />
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
  return { onNavigate };
}

describe("Sidebar", () => {
  it("shows top-level destinations and group headings, hiding sub-items on the dashboard", () => {
    renderSidebar("/");

    expect(screen.getByText("Library")).toBeInTheDocument();
    // "Insights" is both the group heading and the destination link inside it.
    expect(screen.getAllByText("Insights")).toHaveLength(2);
    expect(screen.getByText("System")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Games" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Bookshelf" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Playing" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Wishlist" })).not.toBeInTheDocument();
  });

  it("shows a section's sub-items while inside that section", () => {
    renderSidebar("/games");

    expect(screen.getByRole("link", { name: "Bookshelf" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Playing" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Wishlist" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Games" })).toHaveAttribute("aria-current", "page");
  });

  it("calls onNavigate when a link is followed", () => {
    const { onNavigate } = renderSidebar("/", vi.fn());

    fireEvent.click(screen.getByRole("link", { name: "Games" }));
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });
});
