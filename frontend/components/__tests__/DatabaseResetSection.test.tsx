import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import DatabaseResetSection from "../DatabaseResetSection";

const clearMissingGamesMutate = vi.fn();

vi.mock("../../hooks/useSystem", () => ({
  useResetDatabase: () => ({ mutate: vi.fn(), isPending: false }),
  useClearPlaytime: () => ({ mutate: vi.fn(), isPending: false }),
  useClearMissingGames: () => ({ mutate: clearMissingGamesMutate, isPending: false }),
}));

const renderSection = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <DatabaseResetSection />
    </QueryClientProvider>,
  );

describe("DatabaseResetSection clear missing games", () => {
  it("opens a confirm dialog and calls the mutation only after typing confirm", async () => {
    const user = userEvent.setup();
    renderSection();

    await user.click(screen.getByRole("button", { name: "Clear missing games" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Clear all missing games?")).toBeInTheDocument();

    const deleteButton = within(dialog).getByRole("button", { name: "Clear missing games" });
    expect(deleteButton).toBeDisabled();

    await user.type(within(dialog).getByLabelText(/confirm.*to proceed/), "confirm");
    expect(deleteButton).toBeEnabled();

    await user.click(deleteButton);
    expect(clearMissingGamesMutate).toHaveBeenCalledWith("confirm", expect.anything());
  });
});
