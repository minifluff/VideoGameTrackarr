import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import HiddenSettingsPage from "../HiddenSettingsPage";

const mutateAsync = vi.fn().mockResolvedValue({ updated: 2 });

vi.mock("../../hooks/useLibrary", () => ({
  useSyncAcquiredDates: () => ({ mutateAsync, isPending: false }),
}));

describe("HiddenSettingsPage", () => {
  beforeEach(() => mutateAsync.mockClear());
  it("asks for confirmation, then syncs acquired dates from the game added date", async () => {
    const user = userEvent.setup();
    render(<HiddenSettingsPage />);

    await user.click(screen.getByRole("button", { name: "Sync acquired dates" }));
    expect(
      screen.getByText(/Every owned copy's Acquired date will be replaced/)
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Sync" }));

    expect(mutateAsync).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Updated 2 acquired dates")).toBeInTheDocument();
  });

  it("does nothing when the confirmation is cancelled", async () => {
    const user = userEvent.setup();
    render(<HiddenSettingsPage />);

    await user.click(screen.getByRole("button", { name: "Sync acquired dates" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(mutateAsync).not.toHaveBeenCalled();
  });
});
