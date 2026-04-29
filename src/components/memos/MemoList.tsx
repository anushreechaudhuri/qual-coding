"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db/schema";
import { deleteMemo } from "@/lib/db/operations";
import type { MemoTargetType } from "@/types";

export function MemoList({
  targetType,
  targetId,
}: {
  targetType: MemoTargetType;
  targetId: string;
}) {
  const memos = useLiveQuery(
    () =>
      db.memos
        .where("[targetType+targetId]")
        .equals([targetType, targetId])
        .filter((m) => m.deletedAt === null)
        .toArray(),
    [targetType, targetId]
  );

  if (!memos || memos.length === 0) return null;

  return (
    <div className="space-y-2">
      {memos.map((memo) => (
        <div
          key={memo.id}
          className="rounded border border-stone-100 bg-stone-50 p-3"
        >
          <div
            className="text-sm font-serif text-stone-700 prose prose-sm prose-stone max-w-none"
            dangerouslySetInnerHTML={{ __html: memo.content }}
          />
          <div className="mt-2 flex items-center justify-between text-[10px] text-stone-400">
            <span>{memo.updatedAt.toLocaleDateString()}</span>
            <button
              onClick={() => deleteMemo(memo.id)}
              className="hover:text-red-500"
            >
              delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
