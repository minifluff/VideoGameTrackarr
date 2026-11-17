import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { BarList, StatTile, type BarRow } from "../Stats";

describe("BarList", () => {
  it("shows the empty message when there are no rows", () => {
    render(<BarList rows={[]} empty="Nothing to show yet." otherLabel="Other" />);

    expect(screen.getByText("Nothing to show yet.")).toBeInTheDocument();
  });

  it("lists rows with labels and values", () => {
    const rows: BarRow[] = [
      { label: "Playing", value: 4 },
      { label: "Completed", value: 6 },
    ];

    render(<BarList rows={rows} empty="Nothing to show yet." otherLabel="Other" />);

    expect(screen.getByText("Playing")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByText("6")).toBeInTheDocument();
  });

  it("folds the tail into one Other row past the limit", () => {
    const rows: BarRow[] = Array.from({ length: 12 }, (_, i) => ({
      label: `Row ${i + 1}`,
      value: 20 - i,
    }));

    render(<BarList rows={rows} empty="Nothing to show yet." limit={10} otherLabel="Other" />);

    expect(screen.getAllByRole("listitem")).toHaveLength(10);
    expect(screen.getByText("Other")).toBeInTheDocument();
    expect(screen.getByText("30")).toBeInTheDocument();
    expect(screen.queryByText("Row 10")).not.toBeInTheDocument();
  });

  it("opens the filtered list from a clickable row", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const rows: BarRow[] = [{ label: "Playing", value: 4, onClick }];

    render(<BarList rows={rows} empty="Nothing to show yet." otherLabel="Other" />);

    await user.click(screen.getByText("Playing"));

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe("StatTile", () => {
  it("renders a plain tile with label and value", () => {
    render(<StatTile label="Owned" value={10} />);

    expect(screen.getByText("Owned")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
  });

  it("renders a link tile as a link", () => {
    render(
      <MemoryRouter>
        <StatTile label="Owned consoles" value={2} to="/hardware" />
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: /Owned consoles/ })).toHaveAttribute("href", "/hardware");
  });
});
