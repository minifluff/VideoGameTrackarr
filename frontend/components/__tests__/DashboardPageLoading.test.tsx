import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { createM3Theme } from "../../theme/createM3Theme";
import DashboardPage from "../DashboardPage";

// The four gated queries never resolve, so the page stays behind its loading
// gate — the header must still render, with Customize held disabled until
// the account layout arrives.
vi.mock("../../hooks/useDashboard", () => ({
  useDashboardStats: () => ({ isLoading: true }),
  useReleaseCalendar: () => ({ isLoading: true }),
}));
vi.mock("../../hooks/useHardwareStats", () => ({
  useHardwareStats: () => ({ isLoading: true }),
}));
vi.mock("../../hooks/useInsights", () => ({
  useOnSale: () => ({ data: undefined, isLoading: true }),
  useMissingAddons: () => ({ data: undefined }),
  useDuplicateLibraryItems: () => ({ data: undefined }),
  useAccessoriesWithoutOwnedHardware: () => ({ data: undefined }),
}));
vi.mock("../../hooks/useAuth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../hooks/useAuth")>();
  return {
    ...actual,
    useCurrentUser: () => ({ data: undefined, isLoading: true }),
  };
});

const theme = createM3Theme("light", "normal");

describe("DashboardPage loading", () => {
  it("shows the header while the sections still load, with Customize disabled", () => {
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

    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add game" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Customize" })).toBeDisabled();
    // Sections stay gated — only the header is up early.
    expect(screen.queryByText("Quick add")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Display Mode" })).not.toBeInTheDocument();
  });
});
