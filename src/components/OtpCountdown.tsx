import { useEffect, useMemo, useState } from "react";

interface OTPCountdownProps {
  /** Total duration in seconds */
  duration: number;

  /** Callback when countdown reaches zero */
  onExpire?: () => void;

  /** How often screen readers should be updated (in seconds) */
  announceInterval?: number; // default: 30s
}

export function OTPCountdown({
  duration,
  onExpire,
  announceInterval = 30,
}: OTPCountdownProps) {
  const [timeLeft, setTimeLeft] = useState(duration);
  const [lastAnnounced, setLastAnnounced] = useState(duration);


  useEffect(() => {
    if (timeLeft <= 0) {
      onExpire?.();
      return;
    }

    const interval = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [timeLeft, onExpire]);

  // 🔊 control when screen reader should announce
  useEffect(() => {
    const shouldAnnounce =
      timeLeft === duration || // initial
      timeLeft === 0 || // expired
      timeLeft % announceInterval === 0; // periodic updates

    if (shouldAnnounce) {
      setLastAnnounced(timeLeft);
    }
  }, [timeLeft, announceInterval, duration]);


  const formattedTime = useMemo(() => {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;

    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }, [timeLeft]);


  const announcement = useMemo(() => {
    if (lastAnnounced <= 0) return "Code expired";

    const minutes = Math.floor(lastAnnounced / 60);
    const seconds = lastAnnounced % 60;

    if (minutes > 0) {
      return `${minutes} minute${minutes > 1 ? "s" : ""} ${seconds} seconds remaining`;
    }

    return `${seconds} seconds remaining`;
  }, [lastAnnounced]);

  return (
    <div className="flex flex-col items-start gap-1">
    
      <span className="text-sm font-medium text-gray-700">
        Code expires in{" "}
        <span className="font-semibold tabular-nums">
          {formattedTime}
        </span>
      </span>

      <span
        className="sr-only"
        aria-live="polite"
        aria-atomic="true"
      >
        {announcement}
      </span>
    </div>
  );
}