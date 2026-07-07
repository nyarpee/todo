type ProgressBarProps = {
  value: number;
};

export function ProgressBar({ value }: ProgressBarProps) {
  return (
    <div className="progressInline" aria-label={`Progress ${value}%`}>
      <div className="progressTrack">
        <div
          className={`progressFill ${getProgressClass(value)}`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="progressValue">{value}%</span>
    </div>
  );
}

function getProgressClass(value: number): string {
  if (value === 100) return "isDone";
  if (value >= 50) return "isHalf";
  if (value > 0) return "isStarted";
  return "isZero";
}
