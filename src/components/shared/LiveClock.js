import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import Icons from './Icons';
import { getDisplayZone, wallClockIn, zoneLabel } from '../../utils/dateTime';

// v10.1: the clock shows the display zone (the company's zone, or the user's display zone) - dateTime.js.
// Before v10.1 it added a fixed 8 h to the browser's UTC fields. The real moment ticks; wallClockIn only
// prepares the zone's wall clock for date-fns format.
const useZoneClock = () => {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);
  const zone = getDisplayZone();
  return { wall: wallClockIn(now, zone), zone, label: zoneLabel(zone, now) };
};

const LiveClock = ({
  showSeconds = true,
  showDate = true,
  showTimezone = true,
  className = "",
  size = "normal" // "small", "normal", "large"
}) => {
  const { wall, zone, label } = useZoneClock();

  const formatDateTime = (date) => {
    if (showSeconds) {
      return format(date, 'dd MMM yyyy hh:mm:ss a');
    }
    return format(date, 'dd MMM yyyy hh:mm a');
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'small':
        return {
          container: 'text-sm',
          time: 'font-semibold',
          date: 'text-xs',
          timezone: 'text-xs opacity-75'
        };
      case 'large':
        return {
          container: 'text-lg',
          time: 'font-bold text-xl',
          date: 'text-sm',
          timezone: 'text-sm opacity-75'
        };
      default: // normal
        return {
          container: 'text-base',
          time: 'font-semibold',
          date: 'text-sm',
          timezone: 'text-sm opacity-75'
        };
    }
  };

  const sizeClasses = getSizeClasses();

  return (
    <div className={`flex items-center space-x-2 ${sizeClasses.container} ${className}`}>
      <Icons.Clock size={size === 'small' ? 16 : size === 'large' ? 24 : 20} className="text-blue-600" />

      <div className="flex flex-col">
        {/* Primary display: DD Mmm YYYY HH:MM:SS AM/PM */}
        <div className={`${sizeClasses.time} text-gray-900`}>
          {formatDateTime(wall)}
        </div>

        {showTimezone && (
          <div className={`${sizeClasses.timezone} text-gray-500`}>
            {zone.replace(/_/g, ' ')} ({label})
          </div>
        )}
      </div>
    </div>
  );
};

// Compact version for headers/navbars (DD Mmm YYYY HH:MM AM/PM)
export const CompactClock = ({ className = "" }) => (
  <LiveClock
    showSeconds={false}
    showDate={true}
    showTimezone={false}
    size="small"
    className={className}
  />
);

// Full detailed version for dashboards
export const DetailedClock = ({ className = "" }) => (
  <LiveClock
    showSeconds={true}
    showDate={true}
    showTimezone={true}
    size="large"
    className={className}
  />
);

// Header version: the display zone's time and its short label
export const HeaderClock = ({ className = "" }) => {
  const { wall, label } = useZoneClock();

  return (
    <div className={`flex items-center space-x-1 text-sm text-gray-600 whitespace-nowrap ${className}`}>
      <Icons.Clock size={16} />
      <span className="font-medium">
        {format(wall, 'dd MMM yyyy hh:mm:ss a')}
      </span>
      <span className="text-xs opacity-75">{label}</span>
    </div>
  );
};

export default LiveClock;