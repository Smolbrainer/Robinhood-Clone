// TimeLine.js
import React from 'react'
import './TimeLine.css'

const OPTIONS = ['LIVE', '1D', '1W', '3M', '1Y', '5Y']

export default function TimeLine({ range, setRange }) {
  return (
    <div className="timeline__container">
      <div className="timeline__buttons__container">
        {OPTIONS.map(opt => (
          <div
            key={opt}
            className={`timeline__button${range === opt ? ' active' : ''}`}
            onClick={() => setRange(opt)}
          >
            {opt}
          </div>
        ))}
      </div>
    </div>
  )
}
