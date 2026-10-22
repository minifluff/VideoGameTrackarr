import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import BulkEditLibraryItemsDialog from "../BulkEditLibraryItemsDialog";

const mutateAsync = vi.fn().mockResolvedValue({ updated: 2 });

vi.mock("../../hooks/useLibrary", () => ({
  useBulkUpdateLibraryItems: () => ({ mutateAsync, isPending: false }),
}));

vi.mock("../../hooks/usePlatforms", () => ({
  usePlatforms: () => ({
    data: [
      {
        id: 7,
        igdbId: 167,
        name: "PlayStation 5",
        slug: "ps5",
        abbreviation: "PS5",
        gameCount: 3,
        spineTemplateUrl: null,
        caseHeightMm: null,
        caseSpineMm: null,
        spineColor: null,
        spineIcon: null,
        spineIconUrl: null,
      },
    ],
  }),
}));

vi.mock("../../hooks/useRegions", () => ({
  useRegions: () => ({ data: [{ id: 3, name: "NTSC-U/C (North America)" }] }),
}));

describe("BulkEditLibraryItemsDialog", () => {
  it("applies a format change to every selected item", async () => {
    const user = userEvent.setup();
    const onApplied = vi.fn();
    render(
      <BulkEditLibraryItemsDialog
        open
        itemIds={[11, 12]}
        onClose={vi.fn()}
        onApplied={onApplied}
      />
    );

    expect(screen.getByText("Edit 2 items")).toBeInTheDocument();

    // Field defaults to Format; pick Subscription as the new value.
    await user.click(screen.getByRole("combobox", { name: "New value" }));
    await user.click(await screen.findByRole("option", { name: "Subscription" }));
    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(mutateAsync).toHaveBeenCalledWith({
      itemIds: [11, 12],
      field: "format",
      value: "subscription",
    });
    expect(onApplied).toHaveBeenCalledWith(2);
  });

  it("applies a platform change with a numeric id", async () => {
    const user = userEvent.setup();
    render(
      <BulkEditLibraryItemsDialog open itemIds={[5]} onClose={vi.fn()} onApplied={vi.fn()} />
    );

    await user.click(screen.getByRole("combobox", { name: "Field" }));
    await user.click(await screen.findByRole("option", { name: "Platform" }));
    await user.click(screen.getByRole("combobox", { name: "New value" }));
    await user.click(await screen.findByRole("option", { name: "PlayStation 5" }));
    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(mutateAsync).toHaveBeenCalledWith({ itemIds: [5], field: "platform", value: 7 });
  });

  it("applies free-text edition (blank would clear it)", async () => {
    const user = userEvent.setup();
    render(
      <BulkEditLibraryItemsDialog open itemIds={[9]} onClose={vi.fn()} onApplied={vi.fn()} />
    );

    await user.click(screen.getByRole("combobox", { name: "Field" }));
    await user.click(await screen.findByRole("option", { name: "Edition" }));
    await user.type(screen.getByLabelText("New value"), "Collector's");
    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(mutateAsync).toHaveBeenCalledWith({
      itemIds: [9],
      field: "edition",
      value: "Collector's",
    });
  });
});
