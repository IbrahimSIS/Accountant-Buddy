import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface RevenueChartProps {
  data: Array<{
    month: string;
    income: number;
    expense: number;
  }>;
}

export function RevenueChart({ data }: RevenueChartProps) {
  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(173, 58%, 39%)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(173, 58%, 39%)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis
            dataKey="month"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12 }}
            className="text-muted-foreground"
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12 }}
            className="text-muted-foreground"
            tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "0.5rem",
              boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
            }}
            labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
            formatter={(value: number) => [`JOD ${value.toLocaleString()}`, ""]}
          />
          <Area
            type="monotone"
            dataKey="income"
            stroke="hsl(173, 58%, 39%)"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#incomeGradient)"
            name="Income"
          />
          <Area
            type="monotone"
            dataKey="expense"
            stroke="hsl(0, 72%, 51%)"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#expenseGradient)"
            name="Expenses"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
