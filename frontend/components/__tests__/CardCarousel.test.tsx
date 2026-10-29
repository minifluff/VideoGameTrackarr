import { fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { createM3Theme } from "../../theme/createM3Theme";
import CardCarousel from "../CardCarousel";

// CardCarousel reads M3-specific theme roles that only exist once wrapped in the app's
// real createM3Theme (see ColorModeProvider.tsx); its view-all link needs a router.
const theme = createM3Theme("light", "normal");

function renderCarousel(
  props: {
    items?: number[];
    id?: string;
    viewAllHref?: string;
    actions?: React.ReactNode;
    columnWidth?: number;
  } = {},
) {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>
        <CardCarousel
          items={[1, 2, 3]}
          getItemKey={(n) => n}
          renderItem={(n) => <div>Game {n}</div>}
          title="Now Playing"
          {...props}
        />
      </MemoryRouter>
    </ThemeProvider>
  );
}

describe("CardCarousel", () => {
  it("renders nothing when there are no items", () => {
    renderCarousel({ items: [] });
    expect(screen.queryByText("Now Playing")).not.toBeInTheDocument();
  });

  it("renders the title, items, and paging buttons", () => {
    renderCarousel();
    expect(screen.getByText("Now Playing")).toBeInTheDocument();
    expect(screen.getByText("Game 1")).toBeInTheDocument();
    expect(screen.getByText("Game 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Scroll previous" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Scroll next" })).toBeInTheDocument();
  });

  it("keeps its section id for in-page anchors", () => {
    const { container } = renderCarousel({ id: "now-playing" });
    expect(container.querySelector("section#now-playing")).not.toBeNull();
  });

  it("renders actions beside the title, before the view-all link", () => {
    renderCarousel({
      viewAllHref: "/games",
      actions: <a href="/games/backlog">Backlog · 3</a>,
    });
    const backlog = screen.getByText("Backlog · 3");
    const viewAll = screen.getByRole("link", { name: "View all" });
    expect(backlog.compareDocumentPosition(viewAll) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("pages with scrollBy and re-checks the buttons on window resize", async () => {
    const user = userEvent.setup();
    const { container } = renderCarousel({ columnWidth: 150 });
    const section = container.querySelector("section");
    expect(section).not.toBeNull();
    // Header Stack first, scroll container second.
    const scroller = section!.children[1] as HTMLElement;
    const scrollBy = vi.fn();
    scroller.scrollBy = scrollBy;
    Object.defineProperty(scroller, "scrollWidth", { value: 1000, configurable: true });
    Object.defineProperty(scroller, "clientWidth", { value: 500, configurable: true });
    Object.defineProperty(scroller, "scrollLeft", { value: 0, configurable: true });

    fireEvent.scroll(scroller);
    const next = screen.getByRole("button", { name: "Scroll next" });
    expect(next).not.toBeDisabled();
    await user.click(next);
    expect(scrollBy).toHaveBeenCalledWith({ left: 500, behavior: "smooth" });

    // With fixed-width cards the overflow only changes on resize, so the > button
    // must re-check then (not just on scroll).
    Object.defineProperty(scroller, "scrollLeft", { value: 500, configurable: true });
    fireEvent(window, new Event("resize"));
    expect(screen.getByRole("button", { name: "Scroll next" })).toBeDisabled();
  });
});
