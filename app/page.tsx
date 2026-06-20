"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import {
  Profile, Activity, loadProfile, saveProfile, loadActivities, saveActivities,
  computeActivityKg, dailyBreakdown, dailySeries, seedDemo, uid,
  INDIAN_STATES, DEFAULT_PROFILE,
} from "@/lib/store";
import { BENCHMARKS, DIET_LABELS, TRANSPORT_LABELS, gridFactor, round1 } from "@/lib/factors";
import { recommend } from "@/lib/recommend";

const CAT_COLORS: Record<string, string> = {
  electricity: "#cf7434",
  transport: "#3a7a8c",
  cooking: "#6b4a3a",
  diet: "#1f8a5b",
};

export default function Page() {
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [acts, setActs] = useState<Activity[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setProfile(loadProfile());
    setActs(loadActivities());
    setReady(true);
  }, []);

  const updateProfile = useCallback((p: Profile) => { setProfile(p); saveProfile(p); }, []);
  const updateActs = useCallback((a: Activity[]) => { setActs(a); saveActivities(a); }, []);
  const loadDemo = useCallback(() => {
    const { profile: p, acts: a } = seedDemo();
    updateProfile(p); updateActs(a);
  }, [updateProfile, updateActs]);

  if (!ready) {
    return (
      <main className="wrap" style={{ padding: 40, textAlign: "center" }}>
        <div className="loading-spinner" />
        <p className="tinylabel" style={{ marginTop: 16 }}>Loading your data...</p>
      </main>
    );
  }

  if (!profile.onboarded)
    return <Onboarding onDone={(p) => updateProfile({ ...p, onboarded: true })} onDemo={loadDemo} />;

  return <Dashboard profile={profile} acts={acts} setProfile={updateProfile} setActs={updateActs} />;
}

/* ----------------------------- Onboarding ----------------------------- */
function Onboarding({ onDone, onDemo }: { onDone: (p: Profile) => void; onDemo: () => void }) {
  const [p, setP] = useState<Profile>(DEFAULT_PROFILE);
  const canSubmit = p.name.trim().length > 0;

  return (
    <main className="wrap" style={{ paddingTop: 48, paddingBottom: 60 }}>
      <span className="eyebrow reveal reveal-1">Set up · 30 seconds</span>
      <h1 className="page reveal reveal-2">Most carbon apps use foreign math.<br />This one is built for India.</h1>
      <p className="lead reveal reveal-3">
        Your grid runs on coal, your commute might be an auto, your diet is probably
        vegetarian. Generic trackers get all of that wrong. Tell us three things and
        every number after this is calibrated to where you actually live.
      </p>

      <div className="card pad reveal reveal-4" style={{ marginTop: 28, maxWidth: 560 }}>
        <div className="row r2">
          <div>
            <label className="fld" htmlFor="ob-name">Your name</label>
            <input id="ob-name" value={p.name} placeholder="e.g. Bhunesh"
              autoComplete="given-name"
              onChange={(e) => setP({ ...p, name: e.target.value })} />
          </div>
          <div>
            <label className="fld" htmlFor="ob-state">State (sets your grid factor)</label>
            <select id="ob-state" value={p.state} onChange={(e) => setP({ ...p, state: e.target.value })}>
              {INDIAN_STATES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div className="row r2" style={{ marginTop: 14 }}>
          <div>
            <label className="fld" htmlFor="ob-diet">Diet</label>
            <select id="ob-diet" value={p.diet} onChange={(e) => setP({ ...p, diet: e.target.value })}>
              {Object.entries(DIET_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="fld" htmlFor="ob-hh">People in household</label>
            <input id="ob-hh" type="number" min={1} max={20} value={p.household}
              onChange={(e) => setP({ ...p, household: Math.max(1, Math.min(20, +e.target.value || 1)) })} />
          </div>
        </div>
        <div style={{ marginTop: 12 }} className="tinylabel">
          Your grid: {round1(gridFactor(p.state) * 1000) / 1000} kg CO2/kWh
          {p.state !== "All India" && gridFactor(p.state) < 0.71 && " · cleaner than the national average"}
          {gridFactor(p.state) > 0.71 && " · dirtier than the national average"}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 18, flexWrap: "wrap" }}>
          <button className="btn" disabled={!canSubmit} onClick={() => canSubmit && onDone(p)}>
            Start tracking
          </button>
          <button className="linkbtn" onClick={onDemo}>or explore a sample week first</button>
        </div>
      </div>
    </main>
  );
}

/* ----------------------------- Dashboard ------------------------------ */
function Dashboard({
  profile, acts, setProfile, setActs,
}: {
  profile: Profile; acts: Activity[];
  setProfile: (p: Profile) => void; setActs: (a: Activity[]) => void;
}) {
  const b = useMemo(() => dailyBreakdown(profile, acts), [profile, acts]);
  const recos = useMemo(() => recommend(profile, b), [profile, b]);
  const series = useMemo(() => dailySeries(profile, acts, 7), [profile, acts]);

  const todayVal = series[series.length - 1]?.total ?? 0;
  const yestVal = series[series.length - 2]?.total ?? 0;
  const dayDelta = round1(todayVal - yestVal);
  const daysUnder = series.filter((d) => d.total > 0 && d.total <= BENCHMARKS.india_avg).length;
  const avg7 = round1(series.reduce((s, d) => s + d.total, 0) / Math.max(series.length, 1));
  const seriesMax = Math.max(...series.map((d) => d.total), BENCHMARKS.india_avg, 0.1);

  const pinPct = Math.max(2, Math.min(98, (b.total / BENCHMARKS.world_avg) * 100));
  const vsIndia = round1(b.total - BENCHMARKS.india_avg);

  const cats: { key: keyof typeof CAT_COLORS; label: string; val: number }[] = [
    { key: "electricity", label: "Electricity", val: b.electricity },
    { key: "transport", label: "Transport", val: b.transport },
    { key: "cooking", label: "Cooking", val: b.cooking },
    { key: "diet", label: "Diet", val: b.diet },
  ];
  const max = Math.max(...cats.map((c) => c.val), 0.1);

  return (
    <main className="wrap" style={{ paddingTop: 32, paddingBottom: 60 }}>
      <div className="spread reveal reveal-1">
        <div>
          <span className="eyebrow">Daily footprint{profile.name ? ` · ${profile.name}` : ""}</span>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 10, marginTop: 6 }}>
            <span className="metric xl">{b.total}</span>
            <span className="unit" style={{ paddingBottom: 8 }}>kg CO2e / day</span>
          </div>
          <p className="lead" style={{ marginTop: 6 }}>
            {vsIndia <= 0
              ? <>You&apos;re <b style={{ color: "var(--green-deep)" }}>{Math.abs(vsIndia)} kg below</b> the average Indian. Keep it there.</>
              : <>That&apos;s <b style={{ color: "var(--clay)" }}>{vsIndia} kg above</b> the average Indian. The actions below close the gap fastest.</>}
          </p>
        </div>
        <button
          className="linkbtn"
          onClick={() => {
            if (window.confirm("Reset all data and start over?")) {
              setActs([]); setProfile({ ...profile, onboarded: false });
            }
          }}
        >
          Reset
        </button>
      </div>

      <div className="stack" style={{ marginTop: 26 }}>
        {/* Stats */}
        <div className="stats reveal reveal-1">
          <div className="stat">
            <div className={`n ${dayDelta < 0 ? "down" : dayDelta > 0 ? "up" : ""}`}>
              {dayDelta > 0 ? "+" : ""}{dayDelta}
            </div>
            <div className="l">vs yesterday (kg)</div>
          </div>
          <div className="stat">
            <div className="n down">{daysUnder}<span style={{ fontSize: 14, color: "var(--ink-faint)" }}>/7</span></div>
            <div className="l">days under India avg</div>
          </div>
          <div className="stat">
            <div className="n">{avg7}</div>
            <div className="l">7-day avg (kg/day)</div>
          </div>
        </div>

        {/* Trend */}
        <div className="card pad reveal reveal-2">
          <div className="spread">
            <h2 className="sec">Last 7 days</h2>
            <span className="tinylabel">green = under India avg</span>
          </div>
          <div className="trend">
            <div className="trend-target" style={{ bottom: `${(BENCHMARKS.india_avg / seriesMax) * 100}%` }}>
              <span>India avg {BENCHMARKS.india_avg}</span>
            </div>
            {series.map((d) => (
              <div className="col" key={d.date}>
                <span className="colval">{d.total > 0 ? d.total : ""}</span>
                <div
                  className={`colbar ${d.total > BENCHMARKS.india_avg ? "over" : ""}`}
                  style={{ height: `${(d.total / seriesMax) * 100}%` }}
                  title={`${d.label}: ${d.total} kg`}
                />
                <span className="colday">{d.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Gauge */}
        <div className="card pad reveal reveal-3">
          <div className="spread">
            <h2 className="sec">Where you stand</h2>
            <span className="tinylabel">per person · per day</span>
          </div>
          <div className="gauge">
            <div className="gauge-track">
              <div className="gauge-pin" style={{ left: `${pinPct}%` }} title={`You: ${b.total} kg`} />
            </div>
            <div className="gauge-marks">
              <div className="gauge-mark"><b>0</b>net-zero</div>
              <div className="gauge-mark" style={{ textAlign: "center" }}><b>{BENCHMARKS.india_avg}</b>India avg</div>
              <div className="gauge-mark" style={{ textAlign: "right" }}><b>{BENCHMARKS.world_avg}</b>World avg</div>
            </div>
          </div>
        </div>

        {/* Breakdown + Log side by side on desktop */}
        <div className="grid grid-2">
          <div className="card pad">
            <h2 className="sec">What it&apos;s made of</h2>
            <span className="tinylabel">kg CO2e / day, per person</span>
            <div style={{ marginTop: 14 }}>
              {cats.map((c) => (
                <div className="bar-row" key={c.key}>
                  <div className="bar-label">
                    <span className="swatch" style={{ background: CAT_COLORS[c.key] }} />
                    {c.label}
                  </div>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${(c.val / max) * 100}%`, background: CAT_COLORS[c.key] }} />
                  </div>
                  <span className="metric md">{c.val}</span>
                </div>
              ))}
            </div>
            <p className="tinylabel" style={{ marginTop: 14 }}>
              Diet is a daily baseline from your profile. Electricity &amp; cooking are
              split across {profile.household} {profile.household > 1 ? "people" : "person"}.
            </p>
          </div>

          <Logger profile={profile} acts={acts} setActs={setActs} />
        </div>

        {/* Recommendations */}
        <div className="card pad">
          <div className="spread">
            <div>
              <h2 className="sec">Your biggest levers</h2>
              <span className="tinylabel">ranked by impact x how doable it is — for your footprint</span>
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            {recos.length === 0 && (
              <p className="empty">Log a few activities and your personalized reduction plan appears here.</p>
            )}
            {recos.map((r, i) => (
              <div className="reco" key={i}>
                <div className="reco-rank">{String(i + 1).padStart(2, "0")}</div>
                <div className="reco-body">
                  <div className="reco-title">{r.title}</div>
                  <div className="reco-detail">{r.detail}</div>
                  <span className="chip" style={{ background: `${CAT_COLORS[r.category]}1a`, color: CAT_COLORS[r.category] }}>
                    {r.category}
                  </span>
                </div>
                <div className="reco-save">
                  <div className="n">-{round1(r.saveKgDay)}</div>
                  <div className="l">kg/day</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

/* ------------------------------- Logger ------------------------------- */
function Logger({
  profile, acts, setActs,
}: {
  profile: Profile; acts: Activity[];
  setActs: (a: Activity[]) => void;
}) {
  const [tab, setTab] = useState<"electricity" | "commute" | "lpg" | "flight">("commute");
  const [kwh, setKwh] = useState("");
  const [mode, setMode] = useState("petrol_car");
  const [km, setKm] = useState("");
  const [cyl, setCyl] = useState("");
  const [scanMsg, setScanMsg] = useState<string>("");
  const [scanning, setScanning] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  function add(partial: Omit<Activity, "id" | "kg">) {
    const kg = computeActivityKg(partial, profile.state);
    const a: Activity = { ...partial, id: uid(), kg };
    setActs([a, ...acts].slice(0, 60));
  }

  async function onScanFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 4.5 * 1024 * 1024) { setScanMsg("Image too large (max ~4.5 MB)."); return; }
    setScanning(true); setScanMsg("Reading your document with Gemini...");
    try {
      const b64 = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result).split(",")[1] ?? "");
        r.onerror = () => rej(new Error("read failed"));
        r.readAsDataURL(file);
      });
      const resp = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: b64, mime: file.type || "image/jpeg" }),
      });
      const data = await resp.json();
      if (!data.ok) { setScanMsg(data.error || "Couldn't read that. Enter it manually below."); return; }
      const r = data.result;
      if (r.detected === "electricity" && r.kwh) {
        setTab("electricity"); setKwh(String(r.kwh));
        setScanMsg(`Found ${r.kwh} kWh — review and add.`);
      } else if (r.detected === "fuel" && r.litres) {
        add({ type: "fuel", date: today, litres: r.litres, fuel: r.fuel || "petrol", scanned: true });
        setScanMsg(`Logged ${r.litres} L ${r.fuel || "petrol"} from your receipt.`);
      } else {
        setScanMsg(r.note || "Couldn't read that confidently. Enter it manually below.");
      }
    } catch {
      setScanMsg("Scan failed — check your connection and try again, or enter manually below.");
    } finally { setScanning(false); }
  }

  function submit() {
    if (tab === "electricity" && +kwh > 0) { add({ type: "electricity", date: today, kwh: +kwh }); setKwh(""); }
    else if (tab === "commute" && +km > 0) { add({ type: "commute", date: today, mode, km: +km }); setKm(""); }
    else if (tab === "flight" && +km > 0) { add({ type: "flight", date: today, mode: "domestic_flight", km: +km }); setKm(""); }
    else if (tab === "lpg" && +cyl > 0) { add({ type: "lpg", date: today, cylinders: +cyl }); setCyl(""); }
  }

  return (
    <div className="card pad">
      <h2 className="sec">Log activity</h2>
      <span className="tinylabel">computed live with your state&apos;s factor</span>

      <label className="scanbtn" style={{ marginTop: 12 }}>
        <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={onScanFile} disabled={scanning} />
        {scanning ? (
          <>
            <span className="loading-spinner sm" />
            Scanning...
          </>
        ) : (
          <>
            <span className="scan-ic" aria-hidden>&#8595;</span>
            Scan electricity bill or fuel receipt
          </>
        )}
        <span className="scan-tag">Gemini</span>
      </label>
      {scanMsg && <p className="scan-msg">{scanMsg}</p>}

      <div className="seg" style={{ marginTop: 12 }}>
        {(["commute", "electricity", "lpg", "flight"] as const).map((t) => (
          <button key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>
            {t === "commute" ? "Commute" : t === "electricity" ? "Power" : t === "lpg" ? "Cooking" : "Flight"}
          </button>
        ))}
      </div>

      <div style={{ marginTop: 14 }}>
        {tab === "electricity" && (
          <div>
            <label className="fld" htmlFor="log-kwh">Units used (kWh — from your bill)</label>
            <input id="log-kwh" type="number" min={0} value={kwh} placeholder="e.g. 8"
              onChange={(e) => setKwh(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()} />
          </div>
        )}
        {tab === "commute" && (
          <div className="row r2">
            <div>
              <label className="fld" htmlFor="log-mode">Mode</label>
              <select id="log-mode" value={mode} onChange={(e) => setMode(e.target.value)}>
                {Object.entries(TRANSPORT_LABELS)
                  .filter(([k]) => k !== "domestic_flight")
                  .map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="fld" htmlFor="log-km">Distance (km)</label>
              <input id="log-km" type="number" min={0} value={km} placeholder="e.g. 12"
                onChange={(e) => setKm(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()} />
            </div>
          </div>
        )}
        {tab === "flight" && (
          <div>
            <label className="fld" htmlFor="log-flight">Flight distance (km, one way)</label>
            <input id="log-flight" type="number" min={0} value={km} placeholder="e.g. 1150 (DEL-BLR)"
              onChange={(e) => setKm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()} />
          </div>
        )}
        {tab === "lpg" && (
          <div>
            <label className="fld" htmlFor="log-lpg">LPG cylinders used (14.2 kg each)</label>
            <input id="log-lpg" type="number" min={0} step="0.1" value={cyl} placeholder="e.g. 1"
              onChange={(e) => setCyl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()} />
          </div>
        )}
        <button className="btn sm" style={{ marginTop: 12 }} onClick={submit}>Add to today</button>
      </div>

      <div style={{ marginTop: 16 }}>
        {acts.length === 0
          ? <p className="empty" style={{ padding: "18px 0" }}>No activity yet. Add your commute to begin.</p>
          : acts.slice(0, 8).map((a) => (
            <div className="logitem" key={a.id}>
              <div>
                {labelOf(a)}
                <div className="meta">{a.date}{a.scanned ? " · scanned" : ""}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span className="metric md">{a.kg} <span className="unit">kg</span></span>
                <button className="del"
                  onClick={() => setActs(acts.filter((x) => x.id !== a.id))}
                  aria-label={`Remove ${labelOf(a)}`}
                >remove</button>
              </div>
            </div>
          ))}
        {acts.length > 8 && (
          <p className="tinylabel" style={{ textAlign: "center", paddingTop: 8 }}>
            + {acts.length - 8} more entries
          </p>
        )}
      </div>
    </div>
  );
}

function labelOf(a: Activity): string {
  if (a.type === "electricity") return `Electricity · ${a.kwh} kWh`;
  if (a.type === "lpg") return `Cooking · ${a.cylinders} cylinder${(a.cylinders ?? 0) > 1 ? "s" : ""}`;
  if (a.type === "flight") return `Flight · ${a.km} km`;
  if (a.type === "fuel") return `${a.fuel === "diesel" ? "Diesel" : "Petrol"} · ${a.litres} L`;
  return `${TRANSPORT_LABELS[a.mode ?? ""] ?? "Commute"} · ${a.km} km`;
}
