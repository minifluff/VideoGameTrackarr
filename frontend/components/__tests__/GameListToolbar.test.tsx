import type { ComponentProps } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Tag } from "../../api/types";
import { buildGameFilterParams } from "../../api/games";
import GameListToolbar from "../GameListToolbar";

const tags: Tag[] = [
  { id: 1, name: "Roguelike", color: null, textColor: null },
  { id: 2, name: "Metroidvania", color: null, textColor: null },
];

function renderToolbar(overrides: Partial<ComponentProps<typeof GameListToolbar>> = {}) {
  const props: ComponentProps<typeof GameListToolbar> = {
    searchKeyword: "",
    onSearchKeywordChange: vi.fn(),
    ownershipStatuses: [],
    onOwnershipStatusesChange: vi.fn(),
    ownershipExclude: false,
    onOwnershipExcludeChange: vi.fn(),
    platformOptions: [],
    platformIds: [],
    onPlatformIdsChange: vi.fn(),
    platformExclude: false,
    onPlatformExcludeChange: vi.fn(),
    tagOptions: tags,
    tagIds: [],
    onTagIdsChange: vi.fn(),
    tagExclude: false,
    onTagExcludeChange: vi.fn(),
    genreOptions: [],
    genreIds: [],
    onGenreIdsChange: vi.fn(),
    genreExclude: false,
    onGenreExcludeChange: vi.fn(),
    gameModeOptions: [],
    gameModes: [],
    onGameModesChange: vi.fn(),
    gameModeExclude: false,
    onGameModeExcludeChange: vi.fn(),
    collectionOptions: [],
    collectionIds: [],
    onCollectionIdsChange: vi.fn(),
    collectionExclude: false,
    onCollectionExcludeChange: vi.fn(),
    franchiseOptions: [],
    franchiseIds: [],
    onFranchiseIdsChange: vi.fn(),
    franchiseExclude: false,
    onFranchiseExcludeChange: vi.fn(),
    gameTypes: [],
    onGameTypesChange: vi.fn(),
    gameTypeExclude: false,
    onGameTypeExcludeChange: vi.fn(),
    formats: [],
    onFormatsChange: vi.fn(),
    formatExclude: false,
    onFormatExcludeChange: vi.fn(),
    storefrontOptions: [],
    storefronts: [],
    onStorefrontsChange: vi.fn(),
    storefrontExclude: false,
    onStorefrontExcludeChange: vi.fn(),
    playStatuses: [],
    onPlayStatusesChange: vi.fn(),
    playStatusExclude: false,
    onPlayStatusExcludeChange: vi.fn(),
    matchAll: {},
    onMatchAllChange: vi.fn(),
    sort: "name_asc",
    onSortChange: vi.fn(),
    ...overrides,
  };
  render(<GameListToolbar {...props} />);
  return props;
}

async function openFilters() {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Filters" }));
  return { user, dialog: await screen.findByRole("dialog") };
}

// Filter tab order is Game Types, Tags, Ownership, ... and Game Types has no match toggle,
// so the Tags field's toggle is the first one.
const TAGS_GROUP = 0;

describe("GameListToolbar match mode", () => {
  it("keeps the toggle disabled until two values are picked", async () => {
    renderToolbar({ tagIds: [1] });
    const { dialog } = await openFilters();

    const groups = within(dialog).getAllByRole("group", { name: "Match any or all of the selected values" });
    const tagToggle = within(groups[TAGS_GROUP]).getByRole("button", { name: "Match all" });
    expect(tagToggle).toBeDisabled();
  });

  it("switches a field to Match all without touching the others", async () => {
    const props = renderToolbar({ tagIds: [1, 2], matchAll: { platform: true } });
    const { user, dialog } = await openFilters();

    const groups = within(dialog).getAllByRole("group", { name: "Match any or all of the selected values" });
    await user.click(within(groups[TAGS_GROUP]).getByRole("button", { name: "Match all" }));

    expect(props.onMatchAllChange).toHaveBeenCalledWith({ platform: true, tag: true });
  });

  it("switches Genre to Match all without touching the others", async () => {
    const props = renderToolbar({ genreIds: [1, 2] });
    const { user, dialog } = await openFilters();

    // Toggle order follows the field order: Tags first, then Genre, then Game Modes.
    const groups = within(dialog).getAllByRole("group", { name: "Match any or all of the selected values" });
    await user.click(within(groups[1]).getByRole("button", { name: "Match all" }));

    expect(props.onMatchAllChange).toHaveBeenCalledWith({ genre: true });
  });

  it("offers no match toggle for Game Types", async () => {
    renderToolbar({ gameTypes: ["main_game", "bundle"] });
    const { dialog } = await openFilters();

    // One toggle per field except Game Types: Tags, Genre, Game Modes, Ownership,
    // Play Status, Platforms, Formats, Collections, Series (Storefront only shows once
    // Digital is picked).
    expect(within(dialog).getAllByRole("group", { name: "Match any or all of the selected values" })).toHaveLength(9);
  });

  it("lists the play statuses, including Not started", async () => {
    renderToolbar();
    const { user, dialog } = await openFilters();

    await user.click(within(dialog).getByRole("combobox", { name: "Play Status" }));

    for (const label of ["Not started", "Backlog", "Playing", "Completed", "Abandoned"]) {
      expect(await screen.findByRole("option", { name: label })).toBeInTheDocument();
    }
  });

  it("clears play statuses and match modes with Clear filters", async () => {
    const props = renderToolbar({ playStatuses: ["playing"], matchAll: { tag: true } });
    const { user, dialog } = await openFilters();

    await user.click(within(dialog).getByRole("button", { name: "Clear filters" }));

    expect(props.onPlayStatusesChange).toHaveBeenCalledWith([]);
    expect(props.onPlayStatusExcludeChange).toHaveBeenCalledWith(false);
    expect(props.onMatchAllChange).toHaveBeenCalledWith({});
  });
});

describe("buildGameFilterParams", () => {
  it("only sends a match-all flag when two or more values are selected", () => {
    const params = buildGameFilterParams({
      tagIds: [1, 2],
      platformIds: [3],
      playStatuses: ["playing", "completed"],
      matchAll: { tag: true, platform: true, playStatus: true },
    });

    expect(params.tagMatchAll).toBe(true);
    expect(params.platformMatchAll).toBeUndefined();
    expect(params.playStatus).toEqual(["playing", "completed"]);
    expect(params.playStatusMatchAll).toBe(true);
  });
});

describe("GameListToolbar top-row controls", () => {
  it("changes sort from the Sort menu", async () => {
    const props = renderToolbar();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Sort By" }));
    await user.click(screen.getByRole("menuitem", { name: "Descending" }));

    expect(props.onSortChange).toHaveBeenCalledWith("name_desc");
  });

  it("picks a new field in its default direction from the Sort menu", async () => {
    const props = renderToolbar();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Sort By" }));
    await user.click(screen.getByRole("menuitem", { name: "Year" }));

    expect(props.onSortChange).toHaveBeenCalledWith("release_date_asc");
  });

  it("shows no Options button without per-page card size", () => {
    renderToolbar();

    expect(screen.queryByRole("button", { name: "Options" })).not.toBeInTheDocument();
  });

  it("renders Options and Sort as icon-only buttons", () => {
    renderToolbar({ cardSize: 1.0, onCardSizeChange: vi.fn() });

    // Icon-only: no visible text label, just the icon — the accessible name comes
    // from aria-label, and the Sort tooltip carries the current sort instead.
    expect(screen.getByRole("button", { name: "Options" })).toHaveTextContent("");
    expect(screen.getByRole("button", { name: "Sort By" })).toHaveTextContent("");
  });

  it("puts the select-games button before the search field", () => {
    renderToolbar({ onEnterSelectionMode: vi.fn(), visibleCount: 1 });

    const selectButton = screen.getByRole("button", { name: "Select games" });
    const searchBox = screen.getByRole("textbox");
    expect(
      selectButton.compareDocumentPosition(searchBox) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("changes the page card size from the Options menu", async () => {
    const props = renderToolbar({ cardSize: 1.0, onCardSizeChange: vi.fn() });
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Options" }));
    const slider = screen.getByRole("slider", { name: "Game card size" });
    // Focus without a pointer click — jsdom has no hasPointerCapture, and MUI's
    // slider pointer handlers throw on it.
    slider.focus();
    await user.keyboard("{ArrowLeft}");

    expect(props.onCardSizeChange).toHaveBeenCalledWith(0.9);
  });
});

describe("GameListToolbar on a Platform page", () => {
  it("hides the Platforms field when hidePlatformsField is set", async () => {
    renderToolbar({ hidePlatformsField: true });
    const { dialog } = await openFilters();

    expect(within(dialog).queryByLabelText("Platforms")).not.toBeInTheDocument();
    expect(within(dialog).getByLabelText("Tags")).toBeInTheDocument();
  });

  it("shows the Platforms field by default", async () => {
    renderToolbar();
    const { dialog } = await openFilters();

    expect(within(dialog).getByLabelText("Platforms")).toBeInTheDocument();
  });
});
