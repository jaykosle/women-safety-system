"use client";

import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { TrendingUp } from 'lucide-react';

// Approximated trend data based on the PDF's line chart
const trendData = [
  { year: '2001', domestic: 50000, assault: 35000, kidnap: 10000, rape: 15000, minors: 5000, dowry: 8000, witchcraft: 100 },
  { year: '2005', domestic: 60000, assault: 35000, kidnap: 15000, rape: 18000, minors: 6000, dowry: 8000, witchcraft: 150 },
  { year: '2010', domestic: 95000, assault: 40000, kidnap: 30000, rape: 22000, minors: 8000, dowry: 8500, witchcraft: 200 },
  { year: '2013', domestic: 115000, assault: 70000, kidnap: 50000, rape: 35000, minors: 15000, dowry: 9000, witchcraft: 200 },
  { year: '2017', domestic: 105000, assault: 85000, kidnap: 65000, rape: 35000, minors: 25000, dowry: 8000, witchcraft: 100 },
  { year: '2021', domestic: 130000, assault: 90000, kidnap: 75000, rape: 32000, minors: 20000, dowry: 7000, witchcraft: 50 },
];

export default function CrimeTrendChart() {
  const formatYAxis = (tickItem: any) => `${Number(tickItem) / 1000}K`;

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            Trends in Crimes Against Women (2001 - 2021)
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Historical trajectory of recorded incidents to train predictive models.
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-md text-xs font-semibold">
          <TrendingUp className="w-4 h-4" />
          Historical Analysis
        </div>
      </div>

      {/* Changed h-[400px] to h-100 based on Tailwind suggestion */}
      <div className="h-100 w-full mt-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={trendData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="year" stroke="#64748b" fontSize={12} tickMargin={10} />
            <YAxis tickFormatter={formatYAxis} stroke="#64748b" fontSize={12} width={60} />
            <Tooltip 
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              // Changed (value: number) to (value: any) and added name to properly satisfy Recharts TS types
              formatter={(value: any, name: any) => {
                if (value === undefined) return ["0K", name];
                return [`${(Number(value) / 1000).toFixed(1)}K`, name];
              }}
            />
            <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" />
            
            <Line type="monotone" dataKey="domestic" name="Domestic Violence" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
            <Line type="monotone" dataKey="assault" name="Assault on Women" stroke="#1e40af" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
            <Line type="monotone" dataKey="kidnap" name="Kidnap & Assault" stroke="#f97316" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
            <Line type="monotone" dataKey="rape" name="Rape" stroke="#7e22ce" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
            <Line type="monotone" dataKey="minors" name="Assault on Minors" stroke="#ec4899" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}