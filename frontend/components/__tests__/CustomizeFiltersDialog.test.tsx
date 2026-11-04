import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import CustomizeFiltersDialog from "../CustomizeFiltersDialog";
import type { FilterField } from "../../hooks/useFilterLayout";

const labels = {
  toggles: "Show missing / Include add-ons",
  gameType: "Game Types",
  tags: "Tags",
  genres: "Genre",
  gameModes: "Game Modes",
  ownership: "Ownership",
  playStatus: "Play Status",
  platforms: "Platforms",
  formats: "Formats",
  storefronts: "Storefronts",
  collections: "Collections",
  franchises: "Series",
  steelbookOnly: "Steelbooks only",
} as const;

describe("CustomizeFiltersDialog", () => {
  it("moves a row down, hides another, and saves the draft", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const fields: FilterField[] = [
      { key: "tags", hidden: false },
      { key: "genres", hidden: false },
    ];
    render(
      <CustomizeFiltersDialog
        fields={fields}
        labels={labels}
        saving={false}
        onClose={vi.fn()}
        onSave={onSave}
      />
    );

    await user.click(screen.getByRole("button", { name: "Move Tags down" }));
    await user.click(screen.getByRole("switch", { name: "Show Genre" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(onSave).toHaveBeenCalledWith([
      { key: "genres", hidden: true },
      { key: "tags", hidden: false },
    ]);
  });

  it("resets the listed fields to their default order", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const fields: FilterField[] = [
      { key: "genres", hidden: true },
      { key: "tags", hidden: false },
    ];
    render(
      <CustomizeFiltersDialog
        fields={fields}
        labels={labels}
        saving={false}
        onClose={vi.fn()}
        onSave={onSave}
      />
    );

    await user.click(screen.getByRole("button", { name: "Reset to default" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    // Default order for the listed fields only (Tags before Genre), both shown.
    expect(onSave).toHaveBeenCalledWith([
      { key: "tags", hidden: false },
      { key: "genres", hidden: false },
    ]);
  });
});
