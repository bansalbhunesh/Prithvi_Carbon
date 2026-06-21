import {
  GRID, LPG_CYLINDER, TRANSPORT, TRANSPORT_LABELS, DIET, DIET_LABELS,
  STATE_GRID_MULT, BENCHMARKS,
} from "@/lib/factors";

export const metadata = { title: "Methodology — Prithvi" };

export default function Methodology() {
  return (
    <article className="wrap" style={{ paddingTop: 32, paddingBottom: 60 }}>
      <span className="eyebrow">Auditable by design</span>
      <h1 className="page">Every number traces to a source.</h1>
      <p className="lead">
        There is no model guessing your footprint. Prithvi multiplies what you log
        by published, India-specific emission factors. Here is every factor, its
        unit, and where it comes from — so any result can be checked by hand.
      </p>

      <div className="stack" style={{ marginTop: 28 }}>
        <section className="card pad">
          <h2 className="sec">Electricity</h2>
          <div className="factor-row">
            <div><div className="name">National grid emission factor</div><div className="src">{GRID.source}</div></div>
            <div className="val">{GRID.value} {GRID.unit}</div>
          </div>
          <p className="tinylabel" style={{ marginTop: 12 }}>
            State multipliers adjust this for your local generation mix:
          </p>
          <div style={{ marginTop: 6 }}>
            {Object.entries(STATE_GRID_MULT).map(([s, m]) => (
              <div className="factor-row" key={s}>
                <div className="name">{s}</div>
                <div className="val">{(GRID.value * m).toFixed(3)} kg/kWh</div>
              </div>
            ))}
          </div>
        </section>

        <section className="card pad">
          <h2 className="sec">Transport</h2>
          {Object.entries(TRANSPORT).map(([k, f]) => (
            <div className="factor-row" key={k}>
              <div><div className="name">{TRANSPORT_LABELS[k]}</div><div className="src">{f.source}</div></div>
              <div className="val">{f.value} {f.unit}</div>
            </div>
          ))}
        </section>

        <section className="card pad">
          <h2 className="sec">Cooking</h2>
          <div className="factor-row">
            <div><div className="name">LPG cylinder (14.2 kg)</div><div className="src">{LPG_CYLINDER.source}</div></div>
            <div className="val">{LPG_CYLINDER.value} {LPG_CYLINDER.unit}</div>
          </div>
        </section>

        <section className="card pad">
          <h2 className="sec">Diet (daily lifecycle baseline)</h2>
          {Object.entries(DIET).map(([k, f]) => (
            <div className="factor-row" key={k}>
              <div><div className="name">{DIET_LABELS[k]}</div><div className="src">{f.source}</div></div>
              <div className="val">{f.value} {f.unit}</div>
            </div>
          ))}
        </section>

        <section className="card pad">
          <h2 className="sec">Benchmarks</h2>
          <div className="factor-row">
            <div className="name">Average Indian (per capita)</div>
            <div className="val">{BENCHMARKS.india_avg} kg/day</div>
          </div>
          <div className="factor-row">
            <div className="name">World average</div>
            <div className="val">{BENCHMARKS.world_avg} kg/day</div>
          </div>
          <div className="factor-row">
            <div className="name">1.5°C-aligned 2030 target</div>
            <div className="val">{BENCHMARKS.target_2030} kg/day</div>
          </div>
        </section>

        <section className="card pad">
          <h2 className="sec">Worked example</h2>
          <p className="lead">
            A 12 km petrol-car commute in Maharashtra:
            12 km × 0.155 kg/km = <b style={{ fontFamily: "var(--mono)" }}>1.86 kg CO₂</b>.
            8 kWh of home electricity in the same state:
            8 × (0.71 × 1.05) = <b style={{ fontFamily: "var(--mono)" }}>5.96 kg CO₂</b>, then divided
            across your household. Nothing hidden.
          </p>
        </section>
      </div>
    </article>
  );
}
