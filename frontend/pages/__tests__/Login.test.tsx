import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { createM3Theme } from "../../theme/createM3Theme";
import Login from "../Login";

// Same M3-theme wrapper as the card tests — production renders always go through
// the app's real createM3Theme.
const theme = createM3Theme("light", "normal");

let mockPublicToken: string | null = "public-token-123";

vi.mock("../../hooks/useAuth", () => ({
  useSetupStatus: () => ({ isLoading: false, data: { setupRequired: false } }),
  useLogin: () => ({ mutateAsync: vi.fn(), isPending: false, isError: false }),
}));

vi.mock("../../hooks/useShareLink", () => ({
  usePublicCollectionLink: () => ({ data: mockPublicToken }),
}));

function renderLogin() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <MemoryRouter initialEntries={["/login"]}>
          <Routes>
            <Route path="*" element={<Login />} />
            <Route path="/public/:token/games" element={<div>public games page</div>} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

describe("Login public collection button", () => {
  it("shows the button and navigates to the public collection when a share link exists", () => {
    mockPublicToken = "public-token-123";
    renderLogin();

    fireEvent.click(screen.getByRole("button", { name: "Public Game Collection" }));
    expect(screen.getByText("public games page")).toBeInTheDocument();
  });

  it("hides the button when no share link exists", () => {
    mockPublicToken = null;
    renderLogin();

    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Public Game Collection" })).not.toBeInTheDocument();
  });
});
