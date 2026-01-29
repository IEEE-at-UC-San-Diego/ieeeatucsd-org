import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  type ChartOptions
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { Card, CardBody, CardHeader } from '@heroui/react';
import { TrendingUp } from 'lucide-react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface PointsChartProps {
  data: {
    date: Date;
    points: number;
    cumulative: number;
  }[];
}

export default function PointsChart({ data }: PointsChartProps) {
  const chartData = {
    labels: data.map(d => d.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })),
    datasets: [
      {
        label: 'Total Points',
        data: data.map(d => d.cumulative),
        fill: true,
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
    ],
  };

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        titleColor: '#1f2937',
        bodyColor: '#1f2937',
        borderColor: '#e5e7eb',
        borderWidth: 1,
        padding: 12,
        boxPadding: 4,
      }
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          maxTicksLimit: 7,
          font: {
            size: 10
          }
        }
      },
      y: {
        beginAtZero: true,
        grid: {
          color: '#f3f4f6',
        },
        border: {
            display: false
        },
        ticks: {
            font: {
                size: 10
            }
        }
      },
    },
    interaction: {
      mode: 'nearest',
      axis: 'x',
      intersect: false
    }
  };

  if (data.length < 2) {
    return null;
  }

  return (
    <Card className="w-full h-full" shadow="sm">
      <CardHeader className="flex gap-3 px-6 pt-6 pb-0">
        <div className="p-2 bg-blue-100 rounded-lg">
            <TrendingUp className="w-5 h-5 text-blue-600" />
        </div>
        <div className="flex flex-col">
            <p className="text-md font-bold text-gray-900">Points Growth</p>
            <p className="text-small text-default-500">Your activity over time</p>
        </div>
      </CardHeader>
      <CardBody className="px-4 pb-4 h-[250px]">
        <Line data={chartData} options={options} />
      </CardBody>
    </Card>
  );
}