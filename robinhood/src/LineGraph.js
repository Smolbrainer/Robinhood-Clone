import React, { useEffect, useState } from 'react'
import { Chart as ChartJS, registerables } from 'chart.js'
import 'chartjs-adapter-moment'
import { Line } from 'react-chartjs-2'
import './LineGraph.css'

ChartJS.register(...registerables)

const options = {
  plugins: {
    legend: { display: false },
    tooltip: {
      mode: 'index',
      intersect: false,
    },
  },
  interaction: {
    mode: 'index',
    intersect: false,
  },
  elements: {
    line:  { tension: 0 },
    point: { radius: 0 },
  },
  maintainAspectRatio: false,
  scales: {
    x: {
      type: 'time',
      time: {
        unit: 'day',
        tooltipFormat: 'll',
      },
      ticks: { display: false },
    },
    y: {
      grid: { display: false },
      ticks: { display: false },
    },
  },
}

export default function LineGraph() {
  const [points, setPoints] = useState([])

  useEffect(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const dataArr = []
    let value = 50
    for (let i = 365; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(today.getDate() - i)
      value += Math.round((Math.random() < 0.5 ? 1 : 0) * Math.random() * 10)
      dataArr.push({ x: d, y: value })
    }
    setPoints(dataArr)
  }, [])

  return (
    <div style={{ height: 300 }}>
      {points.length > 0 && (
        <Line
          data={{
            datasets: [
              {
                data: points,
                borderColor: '#5AC53B',
                fill: false,
              },
            ],
          }}
          options={options}
          redraw
        />
      )}
    </div>
  )
}
