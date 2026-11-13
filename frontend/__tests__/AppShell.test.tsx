import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { createM3Theme } from "../theme/createM3Theme";
import { AppearanceProvider } from "../theme/AppearanceProvider";
import { ColorModeProvider } from "../theme/ColorModeProvider";
import AppShell from "../AppShell";
import { ThemeProvider } from "@mui/material/styles";

const theme = createM3Theme("light", "normal");

function renderShell(initialEntries: string[]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: <AppShell />,
        children: [
          { index: true, element: <div>Dashboard page</div> },
          { path: "games", element: <div>Games page</div> },
        ],
      },
    ],
    { initialEntries }
  );
  render(
    <QueryClientProvider client={queryClient}>
      <AppearanceProvider>
        <ColorModeProvider>
          <ThemeProvider theme={theme}>
            <RouterProvider router={router} />
          </ThemeProvider>
        </ColorModeProvider>
      </AppearanceProvider>
    </QueryClientProvider>
  );
  return { router };
}

afterEach(() => {
  localStorage.removeItem("vgt.startPage");
});

describe("AppShell starting page", () => {
  it("opens on the starting page instead of the dashboard", async () => {
    localStorage.setItem("vgt.startPage", "/games");
    renderShell(["/"]);

    expect(await screen.findByText("Games page")).toBeInTheDocument();
    expect(screen.queryByText("Dashboard page")).not.toBeInTheDocument();
  });

  it("stays on the dashboard when the starting page is the dashboard", async () => {
    renderShell(["/"]);

    expect(await screen.findByText("Dashboard page")).toBeInTheDocument();
    expect(screen.queryByText("Games page")).not.toBeInTheDocument();
  });

  it("does not redirect again on later trips to the dashboard", async () => {
    localStorage.setItem("vgt.startPage", "/games");
    const { router } = renderShell(["/"]);

    expect(await screen.findByText("Games page")).toBeInTheDocument();

    // Tapping Dashboard after load lands on "/" and stays there.
    router.navigate("/");
    expect(await screen.findByText("Dashboard page")).toBeInTheDocument();
  });

  it("does not redirect when opening directly on another page", async () => {
    localStorage.setItem("vgt.startPage", "/games");
    renderShell(["/games"]);

    expect(await screen.findByText("Games page")).toBeInTheDocument();
    expect(screen.queryByText("Dashboard page")).not.toBeInTheDocument();
  });
});
