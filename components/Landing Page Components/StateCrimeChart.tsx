"use client"; // Required in Next.js App Router for interactive client components

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { AlertCircle } from 'lucide-react';

// Approximated mock data based on the provided PDF chart structure
const data = [
  { state: 'Uttar Pradesh', domestic: 180000, assault: 140000, kidnap: 150000, rape: 60000, dowry: 50000 },
  { state: 'Madhya Pradesh', domestic: 150000, assault: 110000, kidnap: 80000, rape: 55000, dowry: 20000 },
  { state: 'West Bengal', domestic: 190000, assault: 60000, kidnap: 70000, rape: 30000, dowry: 15000 },
  { state: 'Andhra Pradesh', domestic: 160000, assault: 70000, kidnap: 30000, rape: 20000, dowry: 10000 },
  { state: 'Rajasthan', domestic: 110000, assault: 65000, kidnap: 50000, rape: 40000, dowry: 15000 },
  { state: 'Maharashtra', domestic: 100000, assault: 90000, kidnap: 45000, rape: 35000, dowry: 12000 },
  { state: 'Assam', domestic: 80000, assault: 40000, kidnap: 60000, rape: 20000, dowry: 8000 },
  { state: 'Kerala', domestic: 90000, assault: 50000, kidnap: 10000, rape: 15000, dowry: 5000 },
  { state: 'Odisha', domestic: 60000, assault: 80000, kidnap: 25000, rape: 20000, dowry: 9000 },
  { state: 'Bihar', domestic: 50000, assault: 15000, kidnap: 75000, rape: 15000, dowry: 25000 },
];

export default function StateCrimeChart() {
  // Custom Tooltip for professional formatting
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const total = payload.reduce((sum: number, entry: any) => sum + entry.value, 0);
      return (
        <div className="bg-white p-4 border border-slate-200 shadow-xl rounded-lg text-sm">
          <p className="font-bold text-slate-800 border-b pb-2 mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex justify-between items-center gap-6 py-1">
              <span style={{ color: entry.color }} className="font-medium">
                {entry.name}
              </span>
              <span className="font-semibold text-slate-700">
                {(entry.value / 1000).toFixed(1)}K
              </span>
            </div>
          ))}
          <div className="flex justify-between items-center gap-6 pt-2 mt-2 border-t font-bold text-slate-900">
            <span>Total</span>
            <span>{(total / 1000).toFixed(1)}K</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            State-wise Crime Incident Breakdown
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Proportional distribution of crime categories across top states (2001-2021)[cite: 1, 39].
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-rose-50 text-rose-600 rounded-md text-xs font-semibold">
          <AlertCircle className="w-4 h-4" />
          High Priority Zones
        </div>
      </div>

      <div className="h-[500px] w-full mt-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 0, right: 30, left: 40, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
            <XAxis 
              type="number" 
              tickFormatter={(value) => `${value / 1000}K`}
              stroke="#64748b" 
              fontSize={12}
            />
            <YAxis 
              dataKey="state" 
              type="category" 
              stroke="#64748b" 
              fontSize={12}
              width={100}
              tick={{ fill: '#334155', fontWeight: 500 }}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
            <Legend 
              wrapperStyle={{ paddingTop: '20px' }}
              iconType="circle"
            />
            {/* Professional color palette for serious data representation */}
            <Bar dataKey="domestic" name="Domestic Violence" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />
            <Bar dataKey="assault" name="Assault on Women" stackId="a" fill="#1e40af" radius={[0, 0, 0, 0]} />
            <Bar dataKey="kidnap" name="Kidnap and Assault" stackId="a" fill="#f97316" radius={[0, 0, 0, 0]} />
            <Bar dataKey="rape" name="Rape" stackId="a" fill="#7e22ce" radius={[0, 0, 0, 0]} />
            <Bar dataKey="dowry" name="Dowry Deaths" stackId="a" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}