import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { RiskTrendDay } from '../types';

interface RiskTrendChartProps {
  data: RiskTrendDay[];
}

export default function RiskTrendChart({ data }: RiskTrendChartProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">7-Day Block Trend</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="date" stroke="#64748b" />
          <YAxis stroke="#64748b" />
          <Tooltip
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: '0.5rem',
            }}
          />
          <Legend />
          <Line type="monotone" dataKey="blocks" stroke="#EF4444" strokeWidth={2} name="Blocks" />
          <Line type="monotone" dataKey="checks" stroke="#3B82F6" strokeWidth={2} name="Total Checks" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}