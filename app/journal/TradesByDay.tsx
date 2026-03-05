"use client";

import { useMemo, useState } from "react";

type Trade = {
  id: string;
  symbol: string;
  model: string;
  bias: string;
  entryTime: string;
  exitTime: string;
  pnl: number;
  note?: string;
  screenshotUrl?: string;
};

type TradeDay = {
  date: string;
  trades: Trade[];
};

function formatPnl(pnl: number) {
  const sign = pnl >= 0 ? "+" : "";
  return (
    sign +
    pnl.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
  );
}

export default function TradesByDay({ data }: { data: TradeDay[] }) {
  const [openDate, setOpenDate] = useState<string | null>(null);
  const [isAllOpen, setIsAllOpen] = useState(false);

  const totalDays = data.length;

  const totalPnl = useMemo(
    () => data.reduce((sum, d) => sum + d.trades.reduce((a, t) => a + t.pnl, 0), 0),
    [data]
  );

  const toggleAll = () => {
    setIsAllOpen((prev) => {
      const next = !prev;
      if (!next) setOpenDate(null);
      return next;
    });
  };

  return (
    <div className="bg-[#0b1220] rounded-2xl p-6 text-white shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold">Trades by Day</h2>
          <p className="text-sm text-gray-400">
            {totalDays} day{totalDays > 1 ? "s" : ""} Total {formatPnl(totalPnl)}
          </p>
        </div>

        <button
          onClick={toggleAll}
          className="bg-[#1f2a40] hover:bg-[#273555] px-4 py-2 rounded-lg text-sm"
        >
          {isAllOpen ? "Collapse all" : "Expand all"}
        </button>
      </div>

      <div className="space-y-5">
        {data.map((day) => {
          const dayPnl = day.trades.reduce((a, t) => a + t.pnl, 0);
          const isOpen = isAllOpen || openDate === day.date;

          const toggleDay = () => {
            if (isAllOpen) return;
            setOpenDate(isOpen ? null : day.date);
          };

          return (
            <div
              key={day.date}
              className="bg-[#111a2b] rounded-2xl border border-[#1f2a40] overflow-hidden"
            >
              <div className="p-4 flex items-center justify-between">
                <div>
                  <div className="text-lg font-semibold">{day.date}</div>
                  <div className="text-sm text-gray-400">
                    {day.trades.length} trade{day.trades.length > 1 ? "s" : ""}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      dayPnl >= 0
                        ? "bg-green-900 text-green-300"
                        : "bg-red-900 text-red-300"
                    }`}
                  >
                    {formatPnl(dayPnl)}
                  </span>

                  <button
                    onClick={toggleDay}
                    className={`px-4 py-1.5 rounded-lg text-sm ${
                      isAllOpen
                        ? "bg-[#24314a] opacity-70 cursor-not-allowed"
                        : "bg-[#1f2a40] hover:bg-[#273555]"
                    }`}
                    disabled={isAllOpen}
                    title={isAllOpen ? "Use Expand/Collapse all at the top" : undefined}
                  >
                    {isOpen ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              {isOpen && (
                <div className="px-4 pb-4">
                  <div className="space-y-3">
                    {day.trades.map((t) => (
                      <div
                        key={t.id}
                        className="bg-[#0f1726] rounded-xl border border-[#1f2a40] p-4 flex items-center justify-between"
                      >
                        <div className="min-w-0">
                          <div className="font-semibold">{t.symbol}</div>
                          <div className="text-sm text-gray-300">
                            {t.model} {t.bias}
                          </div>
                          <div className="text-sm text-gray-400">
                            Entry: {t.entryTime} Exit: {t.exitTime}
                          </div>
                          {t.note ? (
                            <div className="text-sm text-gray-400 mt-1 truncate">
                              {t.note}
                            </div>
                          ) : null}
                        </div>

                        <div className="flex items-center gap-3">
                          <span
                            className={`px-3 py-1 rounded-full text-sm font-medium ${
                              t.pnl >= 0
                                ? "bg-green-900 text-green-300"
                                : "bg-red-900 text-red-300"
                            }`}
                          >
                            {formatPnl(t.pnl)}
                          </span>

                          {t.screenshotUrl ? (
                            <img
                              src={t.screenshotUrl}
                              alt="trade screenshot"
                              className="h-10 w-16 rounded-md object-cover border border-[#1f2a40]"
                            />
                          ) : null}

                          <button className="bg-[#1f2a40] hover:bg-[#273555] px-4 py-1.5 rounded-lg text-sm">
                            Edit
                          </button>
                          <button className="bg-red-600 hover:bg-red-700 px-4 py-1.5 rounded-lg text-sm">
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
