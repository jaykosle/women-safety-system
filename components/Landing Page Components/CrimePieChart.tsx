"use client";

import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { PieChart as PieChartIcon } from 'lucide-react';

// Exact percentages from the provided PDF document
const pieData = [
  { name: 'Domestic Violence', value: 39.24, color: '#3b82f6' },
  { name: 'Assault on Women', value: 23.88, color: '#1e40af' },
  { name: 'Kidnap and Assault', value: 17.15, color: '#f97316' },
  { name: 'Rape', value: 11.01, color: '#7e22ce' },
  { name: 'Assault on Minors', value: 5.03, color: '#ec4899' },
  { name: 'Dowry Deaths', value: 3.26, color: '#8b5cf6' },
  { name: 'Witchcraft', value: 0.43, color: '#eab308' },
];

export default function CrimePieChart() {
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-slate-200 shadow-lg rounded-lg text-sm font-medium text-slate-700">
          <span style={{ color: payload[0].payload.color }} className="font-bold mr-2">
            {payload[0].name}:
          </span>
          {payload[0].value}%
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 w-full h-full flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            Proportion of Crimes by Type
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Overall distribution of ~5M recorded cases.
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-purple-50 text-purple-600 rounded-md text-xs font-semibold">
          <PieChartIcon className="w-4 h-4" />
          Distribution
        </div>
      </div>

      <div className="flex-grow w-full min-h-[350px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius={80}
              outerRadius={120}
              paddingAngle={2}
              dataKey="value"
              stroke="none"
            >
              {pieData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              layout="horizontal" 
              verticalAlign="bottom" 
              align="center"
              wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}