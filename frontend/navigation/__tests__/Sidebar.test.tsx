import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createM3Theme } from "../../theme/createM3Theme";
import { AppearanceProvider } from "../../theme/AppearanceProvider";
import { useShareLink } from "../../hooks/useShareLink";
import Sidebar from "../Sidebar";

// The share-link query has no server in jsdom, so it is mocked: no token by
// default (Public Game Collection hidden, as in the app before a link exists),
// a token when a test sets one.
vi.mock("../../hooks/useShareLink", () => ({
  useShareLink: vi.fn(() => ({ data: undefined })),
}));

const mockUseShareLink = vi.mocked(useShareLink);

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

// Same harness plus the real AppearanceProvider, so the hide toggles read
// their localStorage values the way the app does (the server sync fails in
// jsdom and the local values stand, as in PublicSubNav.test.tsx).
function renderSidebarWithAppearance(initialPath: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <AppearanceProvider>
        <ThemeProvider theme={theme}>
          <MemoryRouter initialEntries={[initialPath]}>
            <Sidebar />
          </MemoryRouter>
        </ThemeProvider>
      </AppearanceProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  mockUseShareLink.mockReturnValue({ data: undefined } as unknown as ReturnType<
    typeof useShareLink
  >);
});

afterEach(() => {
  localStorage.removeItem("vgt.hideDashboardMenu");
  localStorage.removeItem("vgt.hideGamesMenu");
  localStorage.removeItem("vgt.hideEventsMenu");
  localStorage.removeItem("vgt.hideAchievementsMenu");
  localStorage.removeItem("vgt.hideInsightsMenu");
  localStorage.removeItem("vgt.hideDisplayModeMenu");
  localStorage.removeItem("vgt.hidePublicCollectionMenu");
});

describe("Sidebar", () => {
  it("shows top-level destinations and group headings, hiding sub-items on the dashboard", () => {
    renderSidebar("/");

    // The sidebar keeps its branding header on desktop — the title bar only
    // carries the title below `md`, where this sidebar is a collapsed drawer.
    expect(screen.getByRole("link", { name: "VideoGameTrackarr" })).toBeInTheDocument();
    expect(screen.getByText("Library")).toBeInTheDocument();
    // "Stats" is the group heading; Achievements comes first inside it, then
    // the Insights destination link (the only "Insights" on the page now).
    expect(screen.getByText("Stats")).toBeInTheDocument();
    expect(screen.getAllByText("Insights")).toHaveLength(1);
    expect(screen.getByText("System")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Achievements" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Insights" })).toBeInTheDocument();
    const linkLabels = screen.getAllByRole("link").map((link) => link.textContent);
    expect(linkLabels.indexOf("Achievements")).toBeLessThan(linkLabels.indexOf("Insights"));
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

  it("calls onNavigate when a leaf link is followed", () => {
    const { onNavigate } = renderSidebar("/", vi.fn());

    fireEvent.click(screen.getByRole("link", { name: "Events" }));
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it("keeps the drawer open when a parent with sub-items is selected, revealing them", () => {
    const { onNavigate } = renderSidebar("/", vi.fn());

    fireEvent.click(screen.getByRole("link", { name: "Games" }));
    // No close: the tap navigates into the section, so its sub-items render
    // in the still-open drawer instead of vanishing with it.
    expect(onNavigate).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "Bookshelf" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Playing" })).toBeInTheDocument();
  });

  it("calls onNavigate when a sub-item is followed", () => {
    const { onNavigate } = renderSidebar("/games", vi.fn());

    fireEvent.click(screen.getByRole("link", { name: "Bookshelf" }));
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it("hides menu pages whose toggles are on, including a whole emptied group", () => {
    localStorage.setItem("vgt.hideGamesMenu", "true");
    localStorage.setItem("vgt.hideAchievementsMenu", "true");
    localStorage.setItem("vgt.hideInsightsMenu", "true");
    renderSidebarWithAppearance("/");

    expect(screen.queryByRole("link", { name: "Games" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Achievements" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Insights" })).not.toBeInTheDocument();
    // Both Stats destinations hidden, so the Stats heading goes with them.
    expect(screen.queryByText("Stats")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Events" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Settings" })).toBeInTheDocument();
  });

  it("shows Display Mode and Public Game Collection links at the bottom of the menu", () => {
    mockUseShareLink.mockReturnValue({ data: "test-token" } as unknown as ReturnType<
      typeof useShareLink
    >);
    renderSidebar("/");

    expect(screen.getByRole("link", { name: "Display Mode" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Public Game Collection" })).toBeInTheDocument();
    // Both sit after the last destination, above the version footer.
    const linkLabels = screen.getAllByRole("link").map((link) => link.textContent);
    expect(linkLabels.indexOf("Settings")).toBeLessThan(linkLabels.indexOf("Display Mode"));
    expect(linkLabels.indexOf("Display Mode")).toBeLessThan(
      linkLabels.indexOf("Public Game Collection")
    );
  });

  it("keeps the Public Game Collection label on one line", () => {
    mockUseShareLink.mockReturnValue({ data: "test-token" } as unknown as ReturnType<
      typeof useShareLink
    >);
    renderSidebar("/");

    // jsdom has no layout, so the one-line rule is asserted on the label
    // span's computed white-space, not on a measured width.
    const label = screen.getByText("Public Game Collection");
    expect(window.getComputedStyle(label).whiteSpace).toBe("nowrap");
    const displayModeLabel = screen.getByText("Display Mode");
    expect(window.getComputedStyle(displayModeLabel).whiteSpace).toBe("nowrap");
  });

  it("hides the bottom buttons whose toggles are on", () => {
    mockUseShareLink.mockReturnValue({ data: "test-token" } as unknown as ReturnType<
      typeof useShareLink
    >);
    localStorage.setItem("vgt.hideDisplayModeMenu", "true");
    localStorage.setItem("vgt.hidePublicCollectionMenu", "true");
    renderSidebarWithAppearance("/");

    expect(screen.queryByRole("link", { name: "Display Mode" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Public Game Collection" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Settings" })).toBeInTheDocument();
  });

  it("hides Public Game Collection when there is no share link", () => {
    renderSidebar("/");

    expect(screen.getByRole("link", { name: "Display Mode" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Public Game Collection" })).not.toBeInTheDocument();
  });
});
