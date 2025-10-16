import * as React from "react"
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "./ui/chart"

// Generate dummy data for the last 90 days (3 months)
const generateChartData = () => {
  const data = []
  for (let i = 89; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const completed = Math.floor(Math.random() * 8) + 2 // 2-10 tasks
    const created = Math.floor(Math.random() * 5) + completed // Always more or equal created
    data.push({
      date: d.toISOString().split('T')[0],
      completed,
      created
    })
  }
  return data
}

const chartConfig = {
  created: {
    label: "생성",
    color: "#3b82f6", // Tailwind blue-500
  },
  completed: {
    label: "완료",
    color: "#10b981", // Green for completed tasks
  },
} satisfies ChartConfig

export function TasksChart() {
  const [chartData] = React.useState(generateChartData())
  const [activeChart, setActiveChart] =
    React.useState<keyof typeof chartConfig>("created")

  const total = React.useMemo(
    () => ({
      created: chartData.reduce((acc, curr) => acc + curr.created, 0),
      completed: chartData.reduce((acc, curr) => acc + curr.completed, 0),
    }),
    [chartData]
  )

  return (
    <Card className="border-[#ededed]">
      <CardHeader className="flex flex-col items-stretch space-y-0 border-b border-[#ededed] p-0 sm:flex-row">
        <div className="flex flex-1 flex-col justify-center gap-1 px-6 py-5 sm:py-6">
          <CardTitle>업무 통계</CardTitle>
          <CardDescription>
            최근 3개월간 업무 생성 및 완료 현황
          </CardDescription>
        </div>
        <div className="flex">
          {["created", "completed"].map((key) => {
            const chart = key as keyof typeof chartConfig
            return (
              <button
                key={chart}
                data-active={activeChart === chart}
                className="relative z-30 flex flex-1 flex-col justify-center gap-1 border-t border-[#ededed] px-6 py-4 text-left even:border-l even:border-[#ededed] data-[active=true]:bg-gray-50 hover:bg-gray-50 sm:border-l sm:border-[#ededed] sm:border-t-0 sm:px-8 sm:py-6 transition-colors"
                onClick={() => setActiveChart(chart)}
              >
                <span className="text-xs text-muted-foreground">
                  {chartConfig[chart].label}
                </span>
                <span className="text-lg font-bold leading-none sm:text-3xl">
                  {total[key as keyof typeof total].toLocaleString()}
                </span>
              </button>
            )
          })}
        </div>
      </CardHeader>
      <CardContent className="px-2 sm:p-6">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[250px] w-full"
        >
          <BarChart
            accessibilityLayer
            data={chartData}
            margin={{
              left: 12,
              right: 12,
            }}
          >
            <CartesianGrid vertical={false} stroke="#ededed" />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value) => {
                const date = new Date(value)
                return date.toLocaleDateString("ko-KR", {
                  month: "short",
                  day: "numeric",
                })
              }}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  className="w-[150px] bg-white border border-gray-200 shadow-md"
                  nameKey="views"
                  labelFormatter={(value) => {
                    return new Date(value).toLocaleDateString("ko-KR", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  }}
                />
              }
            />
            <Bar dataKey={activeChart} fill={`var(--color-${activeChart})`} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
