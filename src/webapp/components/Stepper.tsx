import { CheckIcon } from "./Icons";

const STEPS = ["Matter & documents", "Case theory", "Draft"];

export default function Stepper({ current }: { current: number }) {
  return (
    <nav className="steprail" aria-label="Progress">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const state = n === current ? "active" : n < current ? "done" : "";
        return (
          <div key={label} style={{ display: "contents" }}>
            {i > 0 && <span className={`step-sep ${n <= current ? "done" : ""}`} />}
            <div className={`step ${state}`} aria-current={n === current ? "step" : undefined}>
              <span className="num">{n < current ? <CheckIcon size={15} /> : n}</span>
              <span className="lbl">{label}</span>
            </div>
          </div>
        );
      })}
    </nav>
  );
}
