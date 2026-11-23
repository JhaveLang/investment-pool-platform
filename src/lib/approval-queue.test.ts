import { describe, expect, it } from "vitest";
import { groupByAccount } from "./approval-queue";

const at = (time: string) => new Date(`2026-11-23T${time}:00Z`);

describe("groupByAccount", () => {
  const entries = [
    { id: "ben-deposit", accountId: "ben", createdAt: at("08:00") },
    { id: "anna-withdrawal", accountId: "anna", createdAt: at("09:00") },
    { id: "ben-withdrawal", accountId: "ben", createdAt: at("10:00") },
    { id: "carla-deposit", accountId: "carla", createdAt: at("07:00") },
    { id: "ben-late", accountId: "ben", createdAt: at("11:00") },
  ];

  it("puts each account's requests into one group, newest first", () => {
    const ben = groupByAccount(entries).find((group) => group.accountId === "ben");
    expect(ben?.entries.map((entry) => entry.id)).toEqual(["ben-late", "ben-withdrawal", "ben-deposit"]);
  });

  it("orders the groups by their newest request", () => {
    expect(groupByAccount(entries).map((group) => group.accountId)).toEqual(["ben", "anna", "carla"]);
  });

  it("keeps an empty queue empty", () => {
    expect(groupByAccount([])).toEqual([]);
  });
});
