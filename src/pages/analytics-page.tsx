import { 
  TrendingUp, TrendingDown, Search, Home, LayoutGrid, Wallet, BarChart2,
  CreditCard
} from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, Tooltip,
  BarChart, Bar, Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useState } from "react";

export default function AnalyticsFullPage() {
  // Centralized State: You can replace this initial state with data fetched from an API
  const [dashboardData, setDashboardData] = useState({
    summary: {
      income: 410000,
      expenses: 125178,
      savings: 284822,
      savingsRate: 69.5,
      avgDailySpend: 4173,
      totalFees: 0,
      totalTransactions: 30
    },
    categoryBreakdown: [
      { name: "EMI", value: 60000, color: "#1e3a8a" },
      { name: "Other", value: 50000, color: "#10b981" },
      { name: "Bills & Utilities", value: 15000, color: "#f59e0b" },
      { name: "Food & Dining", value: 178, color: "#ef4444" },
    ],
    paymentMethods: [
      { name: "Credit Card", amount: 75000, percentage: 60, color: "bg-blue-800" },
      { name: "Wallet", amount: 50000, percentage: 40, color: "bg-emerald-500" },
      { name: "Bank", amount: 178, percentage: 0, color: "bg-slate-200" },
    ],
    topExpenses: [
      { id: 1, name: "Other", date: "2026-04-02", amount: 50000 },
      { id: 2, name: "EMI", date: "2026-04-02", amount: 50000 },
      { id: 3, name: "Bills & Utilities", date: "2026-04-07", amount: 15000 },
      { id: 4, name: "EMI", date: "2026-04-09", amount: 10000 },
      { id: 5, name: "Food & Dining", date: "2026-04-02", amount: 178 },
    ],
    dailySpend: [
      { date: "2 Apr", amount: 100000 },
      { date: "7 Apr", amount: 15000 },
      { date: "9 Apr", amount: 12000 },
    ],
    monthlyTrends: [
      { month: "Apr", income: 410000, expense: 125178 },
    ],
    dayOfWeek: [
      { day: "Sun", amount: 0 },
      { day: "Mon", amount: 0 },
      { day: "Tue", amount: 15000 },
      { day: "Wed", amount: 0 },
      { day: "Thu", amount: 110000 },
      { day: "Fri", amount: 0 },
      { day: "Sat", amount: 0 },
    ],
    transactionCounts: [
      { name: "Udhar", count: 14, color: "bg-blue-800" },
      { name: "Card Payment", count: 6, color: "bg-emerald-500" },
      { name: "Expense", count: 5, color: "bg-amber-500" },
      { name: "Income", count: 3, color: "bg-red-500" },
      { name: "Transfer", count: 1, color: "bg-blue-400" },
      { name: "Loan Payment", count: 1, color: "bg-purple-500" },
    ],
    ccUtilization: [
      { name: "HSBC", used: 10000, total: 300000, percentage: 3 },
      { name: "SBI Visa", used: 50000, total: 200000, percentage: 25 },
      { name: "SBI Rupay", used: 100977, total: 200000, percentage: 50 },
      { name: "Axis", used: 2771, total: 100000, percentage: 3 },
      { name: "HDFC", used: 31000, total: 100000, percentage: 31 },
      { name: "Yes", used: 130000, total: 200000, percentage: 65 },
      { name: "IDFC", used: 76218, total: 150000, percentage: 51 },
      { name: "Kotak", used: 35626, total: 100000, percentage: 36 },
      { name: "IndusIND", used: 24425, total: 100000, percentage: 24 },
      { name: "Hitesh card", used: 134782, total: 200000, percentage: 67 },
      { name: "pnb", used: 0, total: 50000, percentage: 0 },
    ],
    udhar: {
      receive: 414335,
      pay: 539641,
      net: -125306
    },
    loan: {
      active: 1,
      emi: 4455,
      principal: 100000
    }
  });

  const [activeTab, setActiveTab] = useState("Month");
  const [searchTerm, setSearchTerm] = useState("");

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 font-sans pb-20">
      <main className="flex-1 max-w-3xl mx-auto w-full p-4 space-y-4">
        
        {/* Time Filters */}
        <div className="flex justify-start gap-2 mb-2">
          {["7 Days", "Month", "3 Months", "Year"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
                activeTab === tab 
                  ? "bg-[#1e1b4b] text-white shadow-sm" 
                  : "bg-white text-slate-500 border hover:bg-slate-50"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <Input 
            placeholder="Search transactions..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-white border-slate-200 shadow-sm rounded-xl"
          />
        </div>

        {/* 1. Summary Header Cards */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="text-center py-4 shadow-sm border-slate-100 rounded-2xl">
            <div className="flex justify-center mb-1">
              <TrendingUp className="text-emerald-500 w-4 h-4" />
            </div>
            <p className="text-[10px] text-slate-500 font-medium mb-1">Income</p>
            <p className="text-sm font-bold text-emerald-600">₹{dashboardData.summary.income.toLocaleString()}</p>
          </Card>
          <Card className="text-center py-4 shadow-sm border-slate-100 rounded-2xl">
            <div className="flex justify-center mb-1">
              <TrendingDown className="text-red-500 w-4 h-4" />
            </div>
            <p className="text-[10px] text-slate-500 font-medium mb-1">Expenses</p>
            <p className="text-sm font-bold text-red-600">₹{dashboardData.summary.expenses.toLocaleString()}</p>
          </Card>
          <Card className="text-center py-4 shadow-sm border-slate-100 rounded-2xl">
            <div className="flex justify-center mb-1">
              <Wallet className="text-emerald-500 w-4 h-4" />
            </div>
            <p className="text-[10px] text-slate-500 font-medium mb-1">Net Savings</p>
            <p className="text-sm font-bold text-emerald-600">₹{dashboardData.summary.savings.toLocaleString()}</p>
          </Card>
        </div>

        {/* 2. Mini Stats Row */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-4 shadow-sm border-slate-100 rounded-2xl">
            <p className="text-[10px] text-slate-500 mb-1">Savings Rate</p>
            <p className="text-lg font-bold text-emerald-600">{dashboardData.summary.savingsRate}%</p>
          </Card>
          <Card className="p-4 shadow-sm border-slate-100 rounded-2xl">
            <p className="text-[10px] text-slate-500 mb-1">Avg Daily Spend</p>
            <p className="text-lg font-bold text-red-600">₹{dashboardData.summary.avgDailySpend.toLocaleString()}</p>
          </Card>
        </div>

        {/* 3. Category Breakdown */}
        <Card className="shadow-sm border-slate-100 rounded-2xl">
          <CardHeader className="pb-0">
            <CardTitle className="text-sm font-bold">Category Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2 pt-4 ">
            <div className="h-28 w-1/4">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={dashboardData.categoryBreakdown} innerRadius={35} outerRadius={55} paddingAngle={2} dataKey="value" stroke="none">
                    {dashboardData.categoryBreakdown.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-3/4 space-y-2">
              {dashboardData.categoryBreakdown.map((item) => (
                <div key={item.name} className="flex justify-between text-xs items-center">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-slate-600">{item.name}</span>
                  </div>
                  <span className="font-semibold">₹{item.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 4. Payment Methods */}
        <Card className="shadow-sm border-slate-100 rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold">Payment Methods</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            {dashboardData.paymentMethods.map((method) => (
              <div key={method.name} className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">{method.name}</span>
                  <span className="font-bold">₹{method.amount.toLocaleString()} ({method.percentage}%)</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div className={`h-full rounded-full ${method.color}`} style={{ width: `${method.percentage}%` }}></div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* 5. Top Expenses */}
        <Card className="shadow-sm border-slate-100 rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold">Top Expenses</CardTitle>
          </CardHeader>
          <CardContent className="space-y-0 pt-0">
            {dashboardData.topExpenses.map((expense, index) => (
              <div key={index} className="flex justify-between items-center py-3 border-b border-slate-50 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-red-50 text-red-500 flex items-center justify-center text-[10px] font-bold">
                    {expense.id}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">{expense.name}</p>
                    <p className="text-[10px] text-slate-400">{expense.date}</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-red-500">₹{expense.amount.toLocaleString()}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* 6. Daily Spending Chart */}
        <Card className="shadow-sm border-slate-100 rounded-2xl">
          <CardHeader className="pb-0">
            <CardTitle className="text-sm font-bold">Daily Spending</CardTitle>
          </CardHeader>
          <CardContent className="h-[200px] pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dashboardData.dailySpend}>
                <XAxis dataKey="date" fontSize={10} tickLine={false} axisLine={{ stroke: '#94a3b8' }} tick={{ fill: '#94a3b8' }} dy={10} />
                <YAxis fontSize={10} tickLine={false} axisLine={{ stroke: '#94a3b8' }} tick={{ fill: '#94a3b8' }} tickFormatter={(val) => `₹${val/1000}k`} dx={-10} />
                <Tooltip />
                <Line type="monotone" dataKey="amount" stroke="#ef4444" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* 7. Monthly Trends */}
        <Card className="shadow-sm border-slate-100 rounded-2xl">
          <CardHeader className="pb-0">
            <CardTitle className="text-sm font-bold">Monthly Trends</CardTitle>
          </CardHeader>
          <CardContent className="h-[200px] pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dashboardData.monthlyTrends} barSize={60}>
                <XAxis dataKey="month" fontSize={10} tickLine={false} axisLine={{ stroke: '#94a3b8' }} tick={{ fill: '#94a3b8' }} dy={10} />
                <YAxis fontSize={10} tickLine={false} axisLine={{stroke: '#94a3b8'}} tick={{ fill: '#94a3b8' }} tickFormatter={(val) => `₹${val/1000}k`} dx={-10} />
                <Tooltip />
                <Legend iconType="square" wrapperStyle={{ fontSize: '10px' }} />
                <Bar dataKey="income" name="Income" fill="#22c55e" radius={[2, 2, 0, 0]} />
                <Bar dataKey="expense" name="Expense" fill="#ef4444" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* 8. Spending by Day of Week */}
        <Card className="shadow-sm border-slate-100 rounded-2xl">
          <CardHeader className="pb-0">
            <CardTitle className="text-sm font-bold">Spending by Day of Week</CardTitle>
          </CardHeader>
          <CardContent className="h-[200px] pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dashboardData.dayOfWeek} barSize={25}>
                <XAxis dataKey="day" fontSize={10} tickLine={false} axisLine={{ stroke: '#94a3b8' }} tick={{ fill: '#94a3b8' }} dy={10} />
                <YAxis fontSize={10} tickLine={false} axisLine={{ stroke: '#94a3b8' }}tick={{ fill: '#94a3b8' }} tickFormatter={(val) => `₹${val/1000}k`} dx={-10} />
                <Tooltip />
                <Bar dataKey="amount" fill="#f59e0b" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* 9. Totals Mini Cards */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-4 shadow-sm border-slate-100 rounded-2xl">
            <p className="text-[10px] text-slate-500 mb-1">Total Fees Paid</p>
            <p className="text-lg font-bold text-red-500">₹{dashboardData.summary.totalFees.toLocaleString()}</p>
          </Card>
          <Card className="p-4 shadow-sm border-slate-100 rounded-2xl">
            <p className="text-[10px] text-slate-500 mb-1">Total Transactions</p>
            <p className="text-lg font-bold text-slate-800">{dashboardData.summary.totalTransactions}</p>
          </Card>
        </div>

        {/* 10. Transaction Count by Type */}
        <Card className="shadow-sm border-slate-100 rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold">Transaction Count by Type</CardTitle>
          </CardHeader>
          <CardContent className="space-y-0 pt-0">
            {dashboardData.transactionCounts.map((type, index) => (
              <div key={index} className="flex justify-between items-center py-3 border-b border-slate-50 last:border-0">
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${type.color}`} />
                  <span className="text-xs font-bold text-slate-700">{type.name}</span>
                </div>
                <span className="text-xs font-bold text-slate-900">{type.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* 11. CC Utilization */}
        <Card className="shadow-sm border-slate-100 rounded-2xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <CreditCard className="w-4 h-4" /> CC Utilization
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 pt-0">
            {dashboardData.ccUtilization.map((card, index) => (
              <div key={index} className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="font-bold text-slate-800">{card.name}</span>
                  <span className="text-slate-500">
                    ₹{card.used.toLocaleString()} / ₹{card.total.toLocaleString()} ({card.percentage}%)
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div className="h-full rounded-full bg-[#1e1b4b]" style={{ width: `${card.percentage}%` }}></div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* 12. Udhar Position */}
        <Card className="shadow-sm border-slate-100 rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
               <span className="text-slate-600">👥</span> Udhar Position
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100/50">
                <p className="text-[10px] text-emerald-700 mb-1">To Receive</p>
                <p className="text-base font-bold text-emerald-600">₹{dashboardData.udhar.receive.toLocaleString()}</p>
              </div>
              <div className="bg-red-50/50 p-4 rounded-xl border border-red-100/50">
                <p className="text-[10px] text-red-700 mb-1">To Pay</p>
                <p className="text-base font-bold text-red-500">₹{dashboardData.udhar.pay.toLocaleString()}</p>
              </div>
            </div>
            <div className="text-center">
              <span className="text-xs text-slate-500">Net: </span>
              <span className="text-xs font-bold text-red-500">{dashboardData.udhar.net < 0 ? '-' : ''}₹{Math.abs(dashboardData.udhar.net).toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>

        {/* 13. Loan Overview */}
        <Card className="shadow-sm border-slate-100 rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
               <span className="text-slate-600">🏛️</span> Loan Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-2 flex justify-between px-6">
            <div className="text-center bg-gray-100 w-[30%] py-3 rounded-sm">
              <p className="text-[10px] text-slate-500 mb-1">Active</p>
              <p className="text-sm font-bold text-slate-800">{dashboardData.loan.active}</p>
            </div>
            <div className="text-center  bg-gray-100 w-[30%] py-3 rounded-sm">
              <p className="text-[10px] text-slate-500 mb-1">Monthly EMI</p>
              <p className="text-sm font-bold text-red-500">₹{dashboardData.loan.emi.toLocaleString()}</p>
            </div>
            <div className="text-center  bg-gray-100 w-[30%] py-3 rounded-sm">
              <p className="text-[10px] text-slate-500 mb-1">Total Principal</p>
              <p className="text-sm font-bold text-slate-800">₹{dashboardData.loan.principal.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>

      </main>

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 w-full bg-white border-t border-slate-100 flex justify-around items-center py-3 pb-safe z-50">
        <button className="flex flex-col items-center gap-1 text-slate-400 hover:text-slate-600">
          <Home className="w-5 h-5" />
          <span className="text-[10px] font-medium">Home</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-slate-400 hover:text-slate-600">
          <LayoutGrid className="w-5 h-5" />
          <span className="text-[10px] font-medium">Entries</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-slate-400 hover:text-slate-600">
          <Wallet className="w-5 h-5" />
          <span className="text-[10px] font-medium">Accounts</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-[#1e1b4b]">
          <BarChart2 className="w-5 h-5" />
          <span className="text-[10px] font-bold">Analytics</span>
          <div className="w-1 h-1 bg-[#1e1b4b] rounded-full mt-0.5"></div>
        </button>
      </nav>
    </div>
  );
}