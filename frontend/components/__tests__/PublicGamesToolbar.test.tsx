import type { ComponentProps } from "react";
import { render, screen, within } from "@testing-library/react";
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

    await user.click(screen.getByRole("button", { name: "Filter & Sort" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("combobox", { name: "Platforms" }));

    expect(await screen.findByRole("option", { name: "Nintendo Switch" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Atari 2600" })).not.toBeInTheDocument();
  });
});
