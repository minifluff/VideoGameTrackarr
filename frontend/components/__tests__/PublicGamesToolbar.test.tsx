import type { ComponentProps } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import PublicGamesToolbar from "../PublicGamesToolbar";

function renderToolbar(overrides: Partial<ComponentProps<typeof PublicGamesToolbar>> = {}) {
  const props: ComponentProps<typeof PublicGamesToolbar> = {
    search: "",
    onSearchChange: vi.fn(),
    sort: "name_asc",
    onSortChange: vi.fn(),
    platformOptions: [],
    platformIds: [],
    onPlatformIdsChange: vi.fn(),
    tagOptions: [],
    tagIds: [],
    onTagIdsChange: vi.fn(),
    genreOptions: [],
    genreIds: [],
    onGenreIdsChange: vi.fn(),
    gameModeOptions: [],
    gameModes: [],
    onGameModesChange: vi.fn(),
    formats: [],
    onFormatsChange: vi.fn(),
    playStatuses: [],
    onPlayStatusesChange: vi.fn(),
    ownershipStatuses: [],
    onOwnershipStatusesChange: vi.fn(),
    onClearFilters: vi.fn(),
    cardSize: 1.0,
    onCardSizeChange: vi.fn(),
    ...overrides,
  };
  render(<PublicGamesToolbar {...props} />);
  return props;
}

describe("PublicGamesToolbar platform filter", () => {
  it("lists only platforms with games in the Platforms dropdown", async () => {
    const user = userEvent.setup();
    renderToolbar({
      platformOptions: [
        { id: 1, name: "Nintendo Switch", gameCount: 4 },
        { id: 2, name: "Atari 2600", gameCount: 0 },
      ],
    });

    await user.click(screen.getByRole("button", { name: "Filters" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("combobox", { name: "Platforms" }));

    expect(await screen.findByRole("option", { name: "Nintendo Switch" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Atari 2600" })).not.toBeInTheDocument();
  });

  it("shows the active filter count as a badge on the Filters button", async () => {
    renderToolbar({ platformIds: [1], tagIds: [2] });

    const filtersButton = screen.getByRole("button", { name: "Filters" });
    expect(within(filtersButton).getByText("2")).toBeInTheDocument();
  });
});

describe("PublicGamesToolbar sort", () => {
  it("changes sort from its own popout, not the filters dialog", async () => {
    const user = userEvent.setup();
    const props = renderToolbar();

    await user.click(screen.getByRole("button", { name: "Sort By" }));
    await user.click(await screen.findByRole("menuitem", { name: "Name (Descending)" }));
    expect(props.onSortChange).toHaveBeenCalledWith("name_desc");

    // The dialog holds filters only — no sort field inside it.
    await user.click(screen.getByRole("button", { name: "Filters" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).queryByRole("combobox", { name: "Sort By" })).not.toBeInTheDocument();
  });
});

describe("PublicGamesToolbar card size", () => {
  it("calls onCardSizeChange from the Options slider", async () => {
    const user = userEvent.setup();
    const props = renderToolbar();

    await user.click(screen.getByRole("button", { name: "Options" }));
    const slider = await screen.findByRole("slider", { name: "Game card size" });
    fireEvent.change(slider, { target: { value: 1.5 } });
    expect(props.onCardSizeChange).toHaveBeenCalledWith(1.5);
  });

  it("hides the Options button when no card size is wired up", () => {
    renderToolbar({ cardSize: undefined, onCardSizeChange: undefined });

    expect(screen.queryByRole("button", { name: "Options" })).not.toBeInTheDocument();
  });
});
