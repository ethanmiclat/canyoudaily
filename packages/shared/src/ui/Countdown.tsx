import { useEffect, useRef, useState } from 'react';
import { formatCountdown, secondsToReset } from '../clock';

type Props = {
  /** Called once when the day rolls over (the hub reloads to the new day). */
  onReset?: () => void;
  label?: string;
};

export function Countdown({ onReset, label = 'New games in' }: Props) {
  const [secs, setSecs] = useState(() => secondsToReset());
  const onResetRef = useRef(onReset);
  onResetRef.current = onReset;

  useEffect(() => {
    let prev = secondsToReset();
    let fired = false;
    const id = setInterval(() => {
      const s = secondsToReset();
      setSecs(s);
      // Right after midnight the value jumps back up to ~86400; that jump is the reset.
      // Also catches a tab that slept through midnight.
      if (!fired && (s === 0 || s > prev + 60)) {
        fired = true;
        onResetRef.current?.();
      }
      prev = s;
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <p className="text-[15px] text-text-muted">
      {label} <time className="font-medium tabular-nums text-text">{formatCountdown(secs)}</time>
    </p>
  );
}
