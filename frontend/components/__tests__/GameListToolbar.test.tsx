import type { ComponentProps } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { FilterFieldSetting, Tag } from "../../api/types";
import { buildGameFilterParams } from "../../api/games";
import { currentUserQueryKey } from "../../hooks/useAuth";
import GameListToolbar from "../GameListToolbar";

const tags: Tag[] = [
  { id: 1, name: "Roguelike", color: null, textColor: null },
  { id: 2, name: "Metroidvania", color: null, textColor: null },
];

// The toolbar reads the saved filter layout through useCurrentUser; without a token
// that query stays disabled (default layout), and a seeded cache entry stands in for
// a signed-in user with a customised layout.
function renderToolbar(
  overrides: Partial<ComponentProps<typeof GameListToolbar>> = {},
  filterLayout?: FilterFieldSetting[] | null
) {
  const props: ComponentProps<typeof GameListToolbar> = {
    searchKeyword: "",
    onSearchKeywordChange: vi.fn(),
    ownershipStatuses: [],
    onOwnershipStatusesChange: vi.fn(),
    ownershipExclude: false,
    onOwnershipExcludeChange: vi.fn(),
    platformOptions: [],
    platformKeys: [],
    onPlatformKeysChange: vi.fn(),
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
    releaseStatuses: [],
    onReleaseStatusesChange: vi.fn(),
    releaseYearFrom: null,
    onReleaseYearFromChange: vi.fn(),
    releaseYearTo: null,
    onReleaseYearToChange: vi.fn(),
    localPlayersMin: null,
    onLocalPlayersMinChange: vi.fn(),
    onlineMultiplayerOnly: false,
    onOnlineMultiplayerOnlyChange: vi.fn(),
    coopOnly: false,
    onCoopOnlyChange: vi.fn(),
    timeToBeat: null,
    onTimeToBeatChange: vi.fn(),
    ratingMin: null,
    onRatingMinChange: vi.fn(),
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
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  if (filterLayout !== undefined) {
    queryClient.setQueryData(currentUserQueryKey, {
      id: 1,
      username: "admin",
      overviewLayout: null,
      overviewCardSize: null,
      filterLayout,
    });
  }
  render(
    <QueryClientProvider client={queryClient}>
      <GameListToolbar {...props} />
    </QueryClientProvider>
  );
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

  it("lists the play statuses, including Not set", async () => {
    renderToolbar();
    const { user, dialog } = await openFilters();

    await user.click(within(dialog).getByRole("combobox", { name: "Play Status" }));

    for (const label of ["Not set", "Not started", "Backlog", "Playing", "On hold", "Endless", "Completed", "Abandoned"]) {
      expect(await screen.findByRole("option", { name: label })).toBeInTheDocument();
    }
  });

  it("offers the release statuses and the year range", async () => {
    const props = renderToolbar();
    const { user, dialog } = await openFilters();

    await user.click(within(dialog).getByRole("combobox", { name: "Release" }));
    await user.click(await screen.findByRole("option", { name: "Upcoming" }));

    expect(props.onReleaseStatusesChange).toHaveBeenCalledWith(["upcoming"]);

    // Typing into a type=number input is unreliable in jsdom, so set the value directly.
    fireEvent.change(within(dialog).getByLabelText("Released from"), {
      target: { value: "2020" },
    });
    expect(props.onReleaseYearFromChange).toHaveBeenCalledWith(2020);
  });

  it("offers the local-players, time-to-beat and rating picks", async () => {
    const props = renderToolbar();
    const { user, dialog } = await openFilters();

    await user.click(within(dialog).getByRole("combobox", { name: "Local players" }));
    await user.click(await screen.findByRole("option", { name: "2+ players" }));
    expect(props.onLocalPlayersMinChange).toHaveBeenCalledWith(2);

    await user.click(within(dialog).getByRole("combobox", { name: "Time to beat" }));
    await user.click(await screen.findByRole("option", { name: "5–15 h" }));
    expect(props.onTimeToBeatChange).toHaveBeenCalledWith("5to15");

    await user.click(within(dialog).getByRole("combobox", { name: "Rating" }));
    await user.click(await screen.findByRole("option", { name: "8.5+ / 10" }));
    expect(props.onRatingMinChange).toHaveBeenCalledWith(85);
  });

  it("offers the online-multiplayer and co-op switches", async () => {
    const props = renderToolbar();
    const { user, dialog } = await openFilters();

    await user.click(within(dialog).getByRole("switch", { name: "Online multiplayer" }));
    expect(props.onOnlineMultiplayerOnlyChange).toHaveBeenCalledWith(true);

    await user.click(within(dialog).getByRole("switch", { name: "Co-op" }));
    expect(props.onCoopOnlyChange).toHaveBeenCalledWith(true);
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

  it("sends platform cards as platformScope and keeps the shared Exclude", () => {
    const params = buildGameFilterParams({ platformScopes: ["6:digital:GOG"], platformExclude: true });

    expect(params.platformScope).toEqual(["6:digital:GOG"]);
    expect(params.platformId).toBeUndefined();
    expect(params.platformExclude).toBe(true);
  });

  it("only sends the toggles and thresholds that are set", () => {
    const params = buildGameFilterParams({
      genreIds: [4],
      localPlayersMin: 2,
      onlineMultiplayerOnly: false,
      coopOnly: true,
      timeToBeatMax: 5,
    });

    expect(params.genreId).toEqual([4]);
    expect(params.localPlayersMin).toBe(2);
    expect(params.onlineMultiplayerOnly).toBeUndefined();
    expect(params.coopOnly).toBe(true);
    expect(params.timeToBeatMin).toBeUndefined();
    expect(params.timeToBeatMax).toBe(5);
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

  it("shows a Show Hidden checkbox in Options and reports the toggle", async () => {
    const props = renderToolbar({
      cardSize: 1.0,
      onCardSizeChange: vi.fn(),
      showHidden: false,
      onShowHiddenChange: vi.fn(),
    });
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Options" }));
    const checkbox = screen.getByRole("checkbox", { name: "Show Hidden" });
    expect(checkbox).not.toBeChecked();
    await user.click(checkbox);

    expect(props.onShowHiddenChange).toHaveBeenCalledWith(true);
  });

  it("shows no Show Hidden checkbox in Options without the toggle props", async () => {
    renderToolbar({ cardSize: 1.0, onCardSizeChange: vi.fn() });
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Options" }));

    expect(screen.queryByRole("checkbox", { name: "Show Hidden" })).not.toBeInTheDocument();
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

describe("GameListToolbar filter layout", () => {
  it("renders fields in the saved order and hides hidden fields", async () => {
    renderToolbar({}, [
      { key: "ownership", hidden: false },
      { key: "tags", hidden: true },
    ]);
    const { dialog } = await openFilters();

    // Ownership moves ahead of Genre (default order is Genre first); Tags is hidden.
    const ownership = within(dialog).getByRole("combobox", { name: "Ownership" });
    const genre = within(dialog).getByRole("combobox", { name: "Genre" });
    expect(ownership.compareDocumentPosition(genre) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(dialog).queryByLabelText("Tags")).not.toBeInTheDocument();
  });

  it("offers the library's platform cards, PC split per storefront", async () => {
    const onPlatformKeysChange = vi.fn();
    renderToolbar({
      platformOptions: [
        { id: "6:digital:Steam", label: "PC · Steam" },
        { id: "130", label: "Nintendo Switch" },
      ],
      onPlatformKeysChange,
    });
    const { user, dialog } = await openFilters();

    await user.click(within(dialog).getByRole("combobox", { name: "Platforms" }));
    await user.click(await screen.findByRole("option", { name: "PC · Steam" }));

    expect(onPlatformKeysChange).toHaveBeenCalledWith(["6:digital:Steam"]);
  });

  it("clears the play filters along with the rest", async () => {
    const props = renderToolbar({
      genreIds: [4],
      localPlayersMin: 2,
      coopOnly: true,
      timeToBeat: "5to15",
    });
    const { user, dialog } = await openFilters();

    await user.click(within(dialog).getByRole("button", { name: "Clear filters" }));

    expect(props.onGenreIdsChange).toHaveBeenCalledWith([]);
    expect(props.onLocalPlayersMinChange).toHaveBeenCalledWith(null);
    expect(props.onCoopOnlyChange).toHaveBeenCalledWith(false);
    expect(props.onTimeToBeatChange).toHaveBeenCalledWith(null);
  });

  it("opens the Customize dialog from the filters dialog", async () => {
    renderToolbar();
    const { user } = await openFilters();

    await user.click(screen.getByRole("button", { name: "Customize" }));

    const customizeDialog = await screen.findByRole("dialog", { name: "Customize filters" });
    expect(customizeDialog).toBeInTheDocument();
    expect(within(customizeDialog).getByText("Tags")).toBeInTheDocument();
  });
});
