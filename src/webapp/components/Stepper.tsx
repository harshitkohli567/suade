
const STEPS = ["Matter & documents", "Case theory", "Draft"];

export default function Stepper({ current }: { current: number }) {
  return (
    <div className="stepper">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const cls = n === current ? "active" : n < current ? "done" : "";
        return (
          <div key={label} className={`stepper-item ${cls}`}>
            <span className="stepper-num">{n < current ? "✓" : n}</span>
            <span>{label}</span>
          </div>
        );
      })}
    </div>
  );
}
