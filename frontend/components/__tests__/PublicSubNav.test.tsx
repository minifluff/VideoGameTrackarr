import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it } from "vitest";
import PublicSubNav from "../PublicSubNav";

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
});
