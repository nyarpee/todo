type ProgressBarProps = {
  value: number;
};

export function ProgressBar({ value }: ProgressBarProps) {
  return (
    <div className="progressInline" aria-label={`Progress ${value}%`}>
      <span className="progressValue">{value}%</span>
    </div>
  );
}
