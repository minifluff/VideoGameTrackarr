import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import VirtualGameGrid from "../VirtualGameGrid";

// jsdom doesn't implement ResizeObserver — VirtualGameGrid needs it for its
// scroll-margin measurement and the virtualizer's row measuring.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("ResizeObserver", ResizeObserverStub);

const items = [{ id: 1 }, { id: 2 }, { id: 3 }];

function renderGrid(props: {
  items: { id: number }[];
  getKey: (item: { id: number }) => number;
  renderItem: (item: { id: number }) => React.ReactNode;
}) {
  return render(
    <MemoryRouter>
      <VirtualGameGrid items={props.items} getKey={props.getKey} renderItem={props.renderItem} />
    </MemoryRouter>,
  );
}

describe("VirtualGameGrid memo", () => {
  it("skips re-rendering when every prop is unchanged", () => {
    const renderItem = vi.fn((item: { id: number }) => <div>Item {item.id}</div>);
    const getKey = (item: { id: number }) => item.id;
    const { rerender } = renderGrid({ items, getKey, renderItem });
    expect(screen.getByText("Item 1")).toBeInTheDocument();
    const callsAfterFirst = renderItem.mock.calls.length;
    expect(callsAfterFirst).toBeGreaterThan(0);

    // A parent re-render with identical props (typing in a toolbar search,
    // the sticky header collapsing on scroll) must not re-run the cards.
    rerender(
      <MemoryRouter>
        <VirtualGameGrid items={items} getKey={getKey} renderItem={renderItem} />
      </MemoryRouter>,
    );
    expect(renderItem.mock.calls.length).toBe(callsAfterFirst);
  });

  it("re-renders when the items change", () => {
    const renderItem = vi.fn((item: { id: number }) => <div>Item {item.id}</div>);
    const getKey = (item: { id: number }) => item.id;
    const { rerender } = renderGrid({ items, getKey, renderItem });
    const callsAfterFirst = renderItem.mock.calls.length;

    const nextItems = [...items, { id: 4 }];
    rerender(
      <MemoryRouter>
        <VirtualGameGrid items={nextItems} getKey={getKey} renderItem={renderItem} />
      </MemoryRouter>,
    );
    expect(renderItem.mock.calls.length).toBeGreaterThan(callsAfterFirst);
    expect(screen.getByText("Item 4")).toBeInTheDocument();
  });
});
