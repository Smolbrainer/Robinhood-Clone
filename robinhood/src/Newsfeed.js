import React from 'react'
import './Newsfeed.css'
import LineGraph from './LineGraph'

function Newsfeed() {
  return (
    <div className='newsfeed'>
        <div className='newsfeed__contianer'>
            <div className='newsfeed__chartSection'>
                <div className='newsfeed__portfolio'>
                    <h1>$140,000</h1>
                    <p>+20,000</p>
                </div>
                <div className='newsfeed_chart'>
                    <LineGraph />
                </div>
            </div>
        </div>
    </div>
  )
}

export default Newsfeed
