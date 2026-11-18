import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { describe, expect, it } from "vitest";
import { createM3Theme } from "../../theme/createM3Theme";
import type { LibraryItem } from "../../api/types";
import GameOwnedOnSection from "../GameOwnedOnSection";

const theme = createM3Theme("light", "normal");

function renderSection(ui: React.ReactElement) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

const ownedSwitch = {
  id: 1,
  status: "owned",
  platformName: "Nintendo Switch",
  format: "digital",
  acquiredAt: "2022-03-11",
} as unknown as LibraryItem;
const ownedPs4NoDate = {
  id: 2,
  status: "owned",
  platformName: "Sony Playstation 4",
  format: "physical",
  acquiredAt: null,
} as unknown as LibraryItem;
const wishlistedPc = {
  id: 3,
  status: "wishlist",
  platformName: "PC",
  format: "digital",
  acquiredAt: null,
} as unknown as LibraryItem;

const props = {
  createdAt: "2026-11-17T14:00:00Z",
  libraryItems: [ownedSwitch, ownedPs4NoDate, wishlistedPc],
};

describe("GameOwnedOnSection", () => {
  it("shows the Owned on chips and stays collapsed by default", () => {
    renderSection(<GameOwnedOnSection {...props} />);

    expect(screen.getByText("Nintendo Switch")).toBeInTheDocument();
    expect(screen.getByText("Sony Playstation 4")).toBeInTheDocument();
    // MUI Collapse keeps its children mounted while closed, so the dates are
    // in the document but hidden until the section expands.
    expect(screen.queryByText("Date Added")).not.toBeVisible();
    expect(screen.getByRole("button", { name: /Owned on/ })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
  });

  it("expands to show Date Added and each owned copy's acquired date", () => {
    renderSection(<GameOwnedOnSection {...props} />);
    fireEvent.click(screen.getByRole("button", { name: /Owned on/ }));

    expect(screen.getByText("Date Added")).toBeInTheDocument();
    expect(screen.getByText("Nov 17, 2026")).toBeInTheDocument();
    expect(screen.getByText("Nintendo Switch · Digital")).toBeInTheDocument();
    expect(screen.getByText("Mar 11, 2022")).toBeInTheDocument();
    expect(screen.getByText("Sony Playstation 4 · Physical")).toBeInTheDocument();
    // The wishlist copy has no acquired date to show, so it gets no row: the
    // Date Added row plus the two owned copies.
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    // Expanded, the platform chips swap out for the dates box.
    expect(screen.queryByText("Nintendo Switch")).not.toBeInTheDocument();
  });

  it("brings the platform chips back when collapsed again", async () => {
    renderSection(<GameOwnedOnSection {...props} />);
    const toggle = screen.getByRole("button", { name: /Owned on/ });
    fireEvent.click(toggle);
    fireEvent.click(toggle);

    expect(screen.getByText("Nintendo Switch")).toBeInTheDocument();
    // The Collapse exit transition hides the dates a beat after the second
    // click, so wait for it rather than asserting mid-transition.
    await waitFor(() =>
      expect(screen.queryByText("Date Added")).not.toBeVisible()
    );
  });

  it("renders nothing with no library items", () => {
    const { container } = renderSection(
      <GameOwnedOnSection createdAt={props.createdAt} libraryItems={[]} />
    );
    expect(container.firstChild).toBeNull();
  });
});
