"""Cash/quantity accounting, independent of the strategy's signal calculation."""
from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal

from quantpilot_market_data.contracts.analysis import BacktestFill, BacktestSignal, BacktestTrade


@dataclass
class ExecutionLedger:
    cash: Decimal
    fee_rate: Decimal
    slippage_rate: Decimal
    quantity: Decimal = Decimal("0")
    realized_pnl: Decimal = Decimal("0")
    trades: list[BacktestTrade] = field(default_factory=list)
    fills: list[BacktestFill] = field(default_factory=list)
    pending: BacktestSignal | None = None

    @property
    def current_trade(self) -> BacktestTrade | None:
        return self.trades[-1] if self.trades and self.trades[-1].status == "open" else None

    @property
    def total_fees(self) -> Decimal:
        return sum((fill.fee for fill in self.fills), Decimal("0"))

    @property
    def total_slippage(self) -> Decimal:
        return sum((fill.slippage_cost for fill in self.fills), Decimal("0"))

    def fill_open(self, date: str, open_price: Decimal) -> str | None:
        signal, self.pending = self.pending, None
        if signal is None:
            return None
        if signal.date >= date:
            raise ValueError("成交必须晚于信号日期。")
        if signal.side == "buy" and self.quantity == 0 and self.cash > 0:
            price = open_price * (1 + self.slippage_rate)
            # Fees are paid from the available cash, never financed by leverage.
            quantity = self.cash / (price * (1 + self.fee_rate))
            notional = quantity * price
            fee = notional * self.fee_rate
            # Algebraically all cash is invested; clamp decimal division residue only.
            self.cash = Decimal("0")
            self.quantity = quantity
            self.trades.append(BacktestTrade(
                entry_signal_date=signal.date, entry_date=date, entry_price=price,
                quantity=quantity, entry_fee=fee,
            ))
        elif signal.side == "sell" and self.quantity > 0:
            price = open_price * (1 - self.slippage_rate)
            quantity = self.quantity
            notional = quantity * price
            fee = notional * self.fee_rate
            self.cash += notional - fee
            self.quantity = Decimal("0")
            trade = self.current_trade
            assert trade is not None
            trade.exit_signal_date = signal.date
            trade.exit_date, trade.exit_price, trade.exit_fee = date, price, fee
            entry_cost = quantity * trade.entry_price + trade.entry_fee
            pnl = notional - fee - entry_cost
            self.realized_pnl += pnl
            trade.gross_return_pct = (price / trade.entry_price - 1) * 100
            trade.return_pct = pnl / entry_cost * 100
            trade.status = "closed"
        else:
            return None
        self.fills.append(BacktestFill(
            signal_date=signal.date, date=date, side=signal.side, reference_price=open_price,
            price=price, quantity=quantity, notional=notional, fee=fee,
            slippage_cost=abs(price - open_price) * quantity,
            cash_after=self.cash, quantity_after=self.quantity,
        ))
        return signal.side

    def unrealized_pnl(self, close: Decimal) -> Decimal:
        trade = self.current_trade
        if trade is None:
            return Decimal("0")
        return self.quantity * (close - trade.entry_price) - trade.entry_fee
