import { describe, expect, it } from "vitest";
import { parseGameSortParam } from "../gameSortOptions";

describe("parseGameSortParam", () => {
  it("accepts every field in both directions", () => {
    expect(parseGameSortParam("date_added_desc")).toBe("date_added_desc");
    expect(parseGameSortParam("date_added_asc")).toBe("date_added_asc");
    expect(parseGameSortParam("name_asc")).toBe("name_asc");
    expect(parseGameSortParam("play_status_desc")).toBe("play_status_desc");
  });

  it("rejects unknown fields, directions, and missing values", () => {
    expect(parseGameSortParam("bogus_desc")).toBeNull();
    expect(parseGameSortParam("date_added_sideways")).toBeNull();
    expect(parseGameSortParam("date_added")).toBeNull();
    expect(parseGameSortParam("")).toBeNull();
    expect(parseGameSortParam(null)).toBeNull();
  });
});
