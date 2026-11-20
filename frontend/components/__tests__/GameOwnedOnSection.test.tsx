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

// Public pages pass the owned copies straight from the public detail
// response — platform and format only, no dates and no edition.
const publicCopies = [
  { platform: "Steam", edition: "Standard", format: "digital" },
  { platform: "Nintendo Switch", edition: null, format: "physical" },
];

describe("GameOwnedOnSection", () => {
  it("shows the Owned on chips and stays collapsed by default", () => {
    renderSection(<GameOwnedOnSection {...props} />);

    expect(screen.getByText("Nintendo Switch")).toBeInTheDocument();
    expect(screen.getByText("Sony Playstation 4")).toBeInTheDocument();
    // The wishlist copy's platform gets no chip — a Wishlisted chip stands
    // in for it instead.
    expect(screen.queryByText("PC")).not.toBeInTheDocument();
    expect(screen.getByText("Wishlisted")).toBeInTheDocument();
    // MUI Collapse keeps its children mounted while closed, so the dates are
    // in the document but hidden until the section expands.
    expect(screen.queryByText("Date Added")).not.toBeVisible();
    expect(screen.getByRole("button", { name: /Owned on/ })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
  });

  it("shows only the Wishlisted chip when every copy is wishlisted", () => {
    renderSection(
      <GameOwnedOnSection createdAt={props.createdAt} libraryItems={[wishlistedPc]} />
    );

    expect(screen.queryByText("PC")).not.toBeInTheDocument();
    expect(screen.getByText("Wishlisted")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Owned on/ }));

    // Expanding shows just the Date Added row — a wishlist copy has no
    // acquired date and gets no row.
    expect(screen.getByText("Date Added")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
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

  it("shows platform + format rows and no dates on public pages", () => {
    renderSection(<GameOwnedOnSection publicCopies={publicCopies} />);

    expect(screen.getByText("Steam")).toBeInTheDocument();
    expect(screen.getByText("Nintendo Switch")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Owned on/ }));

    expect(screen.getByText("Steam · Digital")).toBeInTheDocument();
    expect(screen.getByText("Nintendo Switch · Physical")).toBeInTheDocument();
    // No Date Added row and no edition — just platform and format.
    expect(screen.queryByText("Date Added")).not.toBeInTheDocument();
    expect(screen.queryByText("Standard")).not.toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    // Expanded, the platform chips swap out for the rows box.
    expect(screen.queryByText("Nintendo Switch")).not.toBeInTheDocument();
  });

  it("renders nothing with no public copies", () => {
    const { container } = renderSection(<GameOwnedOnSection publicCopies={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
