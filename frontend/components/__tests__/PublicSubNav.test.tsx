import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import PublicSubNav from "../PublicSubNav";
import { AppearanceProvider } from "../../theme/AppearanceProvider";

function renderNav(initialPath: string, inHeader = false) {
  const router = createMemoryRouter(
    [
      {
        path: "/public/:token/*",
        element: <PublicSubNav inHeader={inHeader} />,
      },
    ],
    { initialEntries: [initialPath] }
  );
  render(<RouterProvider router={router} />);
}

afterEach(() => {
  localStorage.removeItem("vgt.hideHardwareMenu");
});

describe("PublicSubNav", () => {
  it("links all four destinations with the share token", () => {
    renderNav("/public/abc/games");

    expect(screen.getByRole("link", { name: "Games" })).toHaveAttribute(
      "href",
      "/public/abc/games"
    );
    expect(screen.getByRole("link", { name: "Bookshelf" })).toHaveAttribute(
      "href",
      "/public/abc/bookshelf"
    );
    expect(screen.getByRole("link", { name: "List" })).toHaveAttribute(
      "href",
      "/public/abc/games/list"
    );
    expect(screen.getByRole("link", { name: "Hardware" })).toHaveAttribute(
      "href",
      "/public/abc/hardware"
    );
  });

  it("renders the same links in header mode", () => {
    renderNav("/public/abc/hardware", true);

    expect(screen.getByRole("link", { name: "Games" })).toHaveAttribute(
      "href",
      "/public/abc/games"
    );
    expect(screen.getByRole("link", { name: "Hardware" })).toHaveAttribute(
      "href",
      "/public/abc/hardware"
    );
  });

  it("hides the Hardware link when the hide-hardware toggle is on", () => {
    localStorage.setItem("vgt.hideHardwareMenu", "true");
    const router = createMemoryRouter(
      [
        {
          path: "/public/:token/*",
          element: (
            <AppearanceProvider>
              <PublicSubNav />
            </AppearanceProvider>
          ),
        },
      ],
      { initialEntries: ["/public/abc/games"] }
    );
    render(<RouterProvider router={router} />);

    expect(screen.getByRole("link", { name: "Games" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Hardware" })).not.toBeInTheDocument();
  });
});
