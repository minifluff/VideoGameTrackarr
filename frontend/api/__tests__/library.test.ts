import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "../client";
import { bulkDeleteLibraryItems, bulkUpdateLibraryItems } from "../library";

vi.mock("../client", () => ({ apiClient: { post: vi.fn() } }));

const post = vi.mocked(apiClient.post);

describe("bulk update/delete batching", () => {
  beforeEach(() => post.mockClear());
  it("sends a Select-all-sized update in 1000-id batches and sums the counts", async () => {
    post.mockResolvedValue({ data: { updated: 1000 } });
    const itemIds = Array.from({ length: 2500 }, (_, i) => i + 1);

    const result = await bulkUpdateLibraryItems(itemIds, "acquired_at", "2022-03-11");

    expect(post).toHaveBeenCalledTimes(3);
    expect(post).toHaveBeenNthCalledWith(1, "/api/library/bulk-update", {
      item_ids: itemIds.slice(0, 1000),
      field: "acquired_at",
      value: "2022-03-11",
    });
    expect(post).toHaveBeenNthCalledWith(3, "/api/library/bulk-update", {
      item_ids: itemIds.slice(2000),
      field: "acquired_at",
      value: "2022-03-11",
    });
    expect(result).toEqual({ updated: 3000 });
  });

  it("sends a Select-all-sized delete in 1000-id batches and sums the counts", async () => {
    post.mockResolvedValue({ data: { deleted: 1000 } });
    const itemIds = Array.from({ length: 1500 }, (_, i) => i + 1);

    const result = await bulkDeleteLibraryItems(itemIds);

    expect(post).toHaveBeenCalledTimes(2);
    expect(post).toHaveBeenNthCalledWith(2, "/api/library/bulk-delete", {
      item_ids: itemIds.slice(1000),
    });
    expect(result).toEqual({ deleted: 2000 });
  });
});
