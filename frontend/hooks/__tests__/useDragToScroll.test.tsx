import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useDragToScroll } from "../useDragToScroll";

function Harness({ onCardClick }: { onCardClick?: () => void }) {
  useDragToScroll();
  return (
    <div data-testid="scroller" style={{ overflowY: "auto", height: 100 }}>
      <div data-testid="content">
        <button data-testid="card" onClick={onCardClick}>
          Card
        </button>
        <input data-testid="field" />
      </div>
    </div>
  );
}

function makeScrollable() {
  const scroller = screen.getByTestId("scroller");
  Object.defineProperty(scroller, "scrollHeight", { configurable: true, value: 1000 });
  Object.defineProperty(scroller, "clientHeight", { configurable: true, value: 100 });
  return scroller as HTMLElement;
}

function dragFrom(target: HTMLElement, fromY: number, toY: number, pointerType = "mouse") {
  fireEvent.pointerDown(target, { button: 0, pointerType, clientX: 50, clientY: fromY });
  fireEvent.pointerMove(window, { pointerType, clientX: 50, clientY: toY });
  fireEvent.pointerUp(window, { pointerType, clientX: 50, clientY: toY });
}

describe("useDragToScroll", () => {
  it("scrolls a scrollable container when dragged up", () => {
    render(<Harness />);
    const scroller = makeScrollable();
    dragFrom(screen.getByTestId("content"), 100, 50);
    expect(scroller.scrollTop).toBe(50);
  });

  it("suppresses the click after a drag, but not after a plain click", () => {
    const onCardClick = vi.fn();
    render(<Harness onCardClick={onCardClick} />);
    makeScrollable();
    const card = screen.getByTestId("card");

    dragFrom(card, 100, 50);
    fireEvent.click(card);
    expect(onCardClick).not.toHaveBeenCalled();

    fireEvent.pointerDown(card, { button: 0, pointerType: "mouse", clientX: 50, clientY: 100 });
    fireEvent.pointerUp(window, { pointerType: "mouse", clientX: 50, clientY: 100 });
    fireEvent.click(card);
    expect(onCardClick).toHaveBeenCalledTimes(1);
  });

  it("ignores drags starting in a form control", () => {
    render(<Harness />);
    const scroller = makeScrollable();
    dragFrom(screen.getByTestId("field"), 100, 50);
    expect(scroller.scrollTop).toBe(0);
  });

  it("ignores touch pointers, which already scroll natively", () => {
    render(<Harness />);
    const scroller = makeScrollable();
    dragFrom(screen.getByTestId("content"), 100, 50, "touch");
    expect(scroller.scrollTop).toBe(0);
  });

  it("switches scroll-snap off during a drag and restores it on release", () => {
    render(<Harness />);
    const scroller = makeScrollable();
    scroller.style.scrollSnapType = "x mandatory";
    const content = screen.getByTestId("content");
    fireEvent.pointerDown(content, { button: 0, pointerType: "mouse", clientX: 50, clientY: 100 });
    fireEvent.pointerMove(window, { pointerType: "mouse", clientX: 50, clientY: 50 });
    expect(scroller.style.scrollSnapType).toBe("none");
    fireEvent.pointerUp(window, { pointerType: "mouse", clientX: 50, clientY: 50 });
    expect(scroller.style.scrollSnapType).toBe("x mandatory");
  });

  it("locks a diagonal drag to its dominant axis, so a row drag does not move the page", () => {
    function BothAxesHarness() {
      useDragToScroll();
      return (
        <div data-testid="both" style={{ overflowX: "auto", overflowY: "auto", height: 100, width: 100 }}>
          <div data-testid="both-content">Content</div>
        </div>
      );
    }
    render(<BothAxesHarness />);
    const scroller = screen.getByTestId("both") as HTMLElement;
    Object.defineProperty(scroller, "scrollHeight", { configurable: true, value: 1000 });
    Object.defineProperty(scroller, "clientHeight", { configurable: true, value: 100 });
    Object.defineProperty(scroller, "scrollWidth", { configurable: true, value: 1000 });
    Object.defineProperty(scroller, "clientWidth", { configurable: true, value: 100 });
    fireEvent.pointerDown(screen.getByTestId("both-content"), {
      button: 0,
      pointerType: "mouse",
      clientX: 100,
      clientY: 100,
    });
    fireEvent.pointerMove(window, { pointerType: "mouse", clientX: 20, clientY: 80 });
    fireEvent.pointerUp(window, { pointerType: "mouse", clientX: 20, clientY: 80 });
    expect(scroller.scrollLeft).toBe(80);
    expect(scroller.scrollTop).toBe(0);
  });
});
