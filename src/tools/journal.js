import { z } from "zod";

const tradeLog = [];

export function registerJournalTools(server) {
  server.tool(
    "trade_journal_log",
    "Log a trade entry for journaling. Records entry, SL, TP, direction, pair, gates passed, and notes.",
    {
      symbol: z.string().describe("Trading pair (e.g., XAUUSD, EURUSD)"),
      direction: z.enum(["long", "short"]).describe("Trade direction"),
      entry: z.number().describe("Entry price"),
      sl: z.number().describe("Stop loss price"),
      tp: z.number().describe("Take profit price"),
      lot_size: z.number().optional().describe("Position size in lots"),
      gates_passed: z.number().optional().describe("Number of gates passed (out of 7)"),
      setup_type: z.string().optional().describe("Setup type (e.g., 'OB retest', 'FVG fill', 'Silver Bullet')"),
      notes: z.string().optional().describe("Additional notes about the trade"),
    },
    async ({ symbol, direction, entry, sl, tp, lot_size = 0.01, gates_passed, setup_type, notes }) => {
      const risk = Math.abs(entry - sl);
      const reward = Math.abs(tp - entry);
      const rr = risk > 0 ? (reward / risk).toFixed(1) : "N/A";

      const trade = {
        id: tradeLog.length + 1,
        timestamp: new Date().toISOString(),
        symbol,
        direction,
        entry,
        sl,
        tp,
        lot_size,
        riskPips: (risk / (symbol.includes("XAU") ? 0.1 : 0.0001)).toFixed(0),
        rr,
        gates_passed: gates_passed || null,
        setup_type: setup_type || null,
        notes: notes || null,
        status: "OPEN",
        result: null,
      };

      tradeLog.push(trade);

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            logged: true,
            trade,
            todayCount: tradeLog.filter((t) => {
              const today = new Date().toDateString();
              return new Date(t.timestamp).toDateString() === today;
            }).length,
            warning: tradeLog.filter((t) => {
              const today = new Date().toDateString();
              return new Date(t.timestamp).toDateString() === today;
            }).length >= 3 ? "MAX TRADES REACHED — STOP TRADING TODAY" : null,
          }, null, 2),
        }],
      };
    }
  );

  server.tool(
    "trade_journal_close",
    "Close a logged trade with result (win/loss/breakeven).",
    {
      trade_id: z.number().describe("Trade ID from journal log"),
      exit_price: z.number().describe("Exit price"),
      result: z.enum(["win", "loss", "breakeven"]).describe("Trade outcome"),
      pnl: z.number().optional().describe("P&L in dollars"),
      notes: z.string().optional().describe("Post-trade notes / lessons"),
    },
    async ({ trade_id, exit_price, result, pnl, notes }) => {
      const trade = tradeLog.find((t) => t.id === trade_id);
      if (!trade) {
        return { content: [{ type: "text", text: JSON.stringify({ error: `Trade #${trade_id} not found` }) }] };
      }

      trade.status = "CLOSED";
      trade.result = result;
      trade.exitPrice = exit_price;
      trade.pnl = pnl || null;
      trade.closeNotes = notes || null;
      trade.closedAt = new Date().toISOString();

      const stats = getStats();

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            closed: true,
            trade,
            sessionStats: stats,
          }, null, 2),
        }],
      };
    }
  );

  server.tool(
    "trade_journal_stats",
    "Get trading statistics from the journal — win rate, average RR, streak, and lessons.",
    {},
    async () => {
      const stats = getStats();
      return { content: [{ type: "text", text: JSON.stringify(stats, null, 2) }] };
    }
  );
}

function getStats() {
  const closed = tradeLog.filter((t) => t.status === "CLOSED");
  const wins = closed.filter((t) => t.result === "win").length;
  const losses = closed.filter((t) => t.result === "loss").length;
  const be = closed.filter((t) => t.result === "breakeven").length;

  let streak = 0;
  let streakType = null;
  for (let i = closed.length - 1; i >= 0; i--) {
    if (streakType === null) streakType = closed[i].result;
    if (closed[i].result === streakType) streak++;
    else break;
  }

  const totalPnl = closed.reduce((s, t) => s + (t.pnl || 0), 0);

  return {
    totalTrades: tradeLog.length,
    openTrades: tradeLog.filter((t) => t.status === "OPEN").length,
    closedTrades: closed.length,
    wins,
    losses,
    breakeven: be,
    winRate: closed.length > 0 ? `${((wins / closed.length) * 100).toFixed(0)}%` : "N/A",
    totalPnl: `$${totalPnl.toFixed(2)}`,
    currentStreak: `${streak} ${streakType || "—"}`,
    rule: losses >= 2 ? "2 LOSSES — Consider stopping for today." : "OK to continue.",
  };
}
