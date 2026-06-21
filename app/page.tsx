"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  Profile, Activity, loadProfile, saveProfile, loadActivities, saveActivities,
  computeActivityKg, dailyBreakdown, dailySeries, seedDemo, uid,
  INDIAN_STATES, DEFAULT_PROFILE,
} from "@/lib/store";
import { BENCHMARKS, DIET_LABELS, TRANSPORT_LABELS, gridFactor, round1 } from "@/lib/factors";
import { recommend } from "@/lib/recommend";

type Category = "electricity" | "transport" | "cooking" | "diet";

const CAT_COLORS: Record<Category, string> = {
  electricity: "#cf7434",
  transport: "#3a7a8c",
  cooking: "#6b4a3a",
  diet: "#1f8a5b",
};

const CAT_ICONS: Record<Category, string> = {
  electricity: "⚡",
  transport: "🚗",
  cooking: "🔥",
  diet: "🌿",
};

const ACTIVITY_MAX = 100;
const TOAST_DURATION_MS = 3000;
const TREE_OFFSET_TONNES = 0.022;

function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const show = useCallback((m: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setMsg(m);
    timerRef.current = setTimeout(() => setMsg(null), TOAST_DURATION_MS);
  }, []);
  return { msg, show };
}

function Toast({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return <div className="toast" role="status" aria-live="polite">{msg}</div>;
}

export default function Page() {
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [acts, setActs] = useState<Activity[]>([]);
  const [ready, setReady] = useState(false);
  const toast = useToast();

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
    toast.show("Sample week loaded — explore your dashboard");
  }, [updateProfile, updateActs, toast]);

  if (!ready) {
    return (
      <section className="wrap" style={{ padding: 80, textAlign: "center" }} aria-busy="true">
        <div className="loading-spinner" role="status" aria-label="Loading" />
        <p className="tinylabel" style={{ marginTop: 16 }}>Loading Prithvi...</p>
      </section>
    );
  }

  if (!profile.onboarded)
    return (
      <>
        <Toast msg={toast.msg} />
        <Onboarding onDone={(p) => { updateProfile({ ...p, onboarded: true }); toast.show("Welcome, " + (p.name || "there") + "! Start logging to see your footprint."); }} onDemo={loadDemo} />
      </>
    );

  return (
    <>
      <Toast msg={toast.msg} />
      <Dashboard profile={profile} acts={acts} setProfile={updateProfile} setActs={updateActs} toast={toast} />
    </>
  );
}

/* ----------------------------- Onboarding ----------------------------- */
function Onboarding({ onDone, onDemo }: { onDone: (p: Profile) => void; onDemo: () => void }) {
  const [p, setP] = useState<Profile>(DEFAULT_PROFILE);
  const canSubmit = p.name.trim().length > 0;
  const gridValue = gridFactor(p.state);

  const handleSubmit = useCallback(() => {
    if (canSubmit) onDone(p);
  }, [canSubmit, onDone, p]);

  return (
    <section className="wrap" aria-labelledby="ob-heading" style={{ paddingTop: 48, paddingBottom: 60 }}>
      <span className="eyebrow reveal reveal-1">Set up · 30 seconds</span>
      <h1 id="ob-heading" className="page reveal reveal-2">Most carbon apps use<br />foreign math. This one<br />is built for India.</h1>
      <p className="lead reveal reveal-3">
        Your grid runs on coal, your commute might be an auto, your diet is probably
        vegetarian. Generic trackers get all of that wrong. Tell us three things and
        every number after this is calibrated to <em>where you actually live</em>.
      </p>

      <form className="card pad reveal reveal-4" style={{ marginTop: 28, maxWidth: 560 }} onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
        <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
          <legend className="sr-only">Your profile</legend>
          <div className="row r2">
            <div>
              <label className="fld" htmlFor="ob-name">Your name</label>
              <input id="ob-name" value={p.name} placeholder="e.g. Bhunesh" autoComplete="given-name" required
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
                aria-describedby="hh-hint"
                onChange={(e) => setP({ ...p, household: Math.max(1, Math.min(20, +e.target.value || 1)) })} />
              <span id="hh-hint" className="sr-only">Electricity and cooking emissions are divided by this number</span>
            </div>
          </div>
        </fieldset>
        <div className="grid-factor-preview" aria-live="polite">
          Your grid: <b>{round1(gridValue * 1000) / 1000}</b> kg CO2/kWh
          {p.state !== "All India" && gridValue < 0.71 && <span className="gf-tag green">cleaner than average</span>}
          {gridValue > 0.71 && <span className="gf-tag clay">dirtier than average</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 18, flexWrap: "wrap" }}>
          <button type="submit" className="btn" disabled={!canSubmit}>
            Start tracking
          </button>
          <button type="button" className="linkbtn" onClick={onDemo}>or explore a sample week first</button>
        </div>
      </form>

      <div className="ob-features reveal reveal-4" role="list" aria-label="Key features">
        <div className="ob-feat" role="listitem"><span aria-hidden="true">&#128247;</span><b>Scan bills</b>Gemini reads your electricity bill or fuel receipt</div>
        <div className="ob-feat" role="listitem"><span aria-hidden="true">&#128202;</span><b>Track daily</b>7-day trend, per-person breakdown, India benchmark</div>
        <div className="ob-feat" role="listitem"><span aria-hidden="true">&#127793;</span><b>Reduce smart</b>Actions ranked by YOUR biggest lever, not generic tips</div>
      </div>
    </section>
  );
}

/* ----------------------------- Dashboard ------------------------------ */
interface DashboardProps {
  profile: Profile;
  acts: Activity[];
  setProfile: (p: Profile) => void;
  setActs: (a: Activity[]) => void;
  toast: { show: (m: string) => void };
}

function Dashboard({ profile, acts, setProfile, setActs, toast }: DashboardProps) {
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

  const annualTonnes = round1((b.total * 365) / 1000);
  const treesNeeded = Math.ceil(annualTonnes / TREE_OFFSET_TONNES);

  const streak = useMemo(() => {
    let count = 0;
    for (let i = series.length - 1; i >= 0; i--) {
      if (series[i].total > 0 && series[i].total <= BENCHMARKS.india_avg) count++;
      else break;
    }
    return count;
  }, [series]);

  const categories: { key: Category; label: string; val: number }[] = [
    { key: "electricity", label: "Electricity", val: b.electricity },
    { key: "transport", label: "Transport", val: b.transport },
    { key: "cooking", label: "Cooking", val: b.cooking },
    { key: "diet", label: "Diet", val: b.diet },
  ];
  const maxCatVal = Math.max(...categories.map((c) => c.val), 0.1);

  return (
    <section className="wrap" aria-labelledby="dash-heading" style={{ paddingTop: 32, paddingBottom: 60 }}>
      <div className="spread reveal reveal-1">
        <div>
          <span id="dash-heading" className="eyebrow">Daily footprint{profile.name ? ` · ${profile.name}` : ""}</span>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 10, marginTop: 6 }}>
            <span className="metric xl" aria-label={`${b.total} kilograms CO2 equivalent per day`}>{b.total}</span>
            <span className="unit" style={{ paddingBottom: 8 }}>kg CO2e / day</span>
          </div>
          <p className="lead" style={{ marginTop: 6 }}>
            {vsIndia <= 0
              ? <>You&apos;re <b className="green-text">{Math.abs(vsIndia)} kg below</b> the average Indian. Keep it there.</>
              : <>That&apos;s <b className="clay-text">{vsIndia} kg above</b> the average Indian. The actions below close the gap fastest.</>}
          </p>
        </div>
        <button
          className="linkbtn"
          aria-label="Reset all data and start over"
          onClick={() => { if (window.confirm("Reset all data and start over?")) { setActs([]); setProfile({ ...profile, onboarded: false }); } }}
        >
          Reset
        </button>
      </div>

      <div className="stack" style={{ marginTop: 26 }}>
        <div className="stats reveal reveal-1" role="group" aria-label="Key statistics">
          <div className="stat">
            <div className={`n ${dayDelta < 0 ? "down" : dayDelta > 0 ? "up" : ""}`}>
              {dayDelta > 0 ? "+" : ""}{dayDelta}
            </div>
            <div className="l">vs yesterday</div>
          </div>
          <div className="stat">
            <div className="n">{avg7}</div>
            <div className="l">7-day avg</div>
          </div>
          <div className="stat">
            <div className={`n ${streak >= 3 ? "down" : ""}`}>
              {streak > 0 ? `${streak}d` : "-"}
            </div>
            <div className="l">streak</div>
          </div>
          <div className="stat">
            <div className="n">{annualTonnes}<span style={{ fontSize: 12, color: "var(--ink-faint)" }}>t</span></div>
            <div className="l">yearly est.</div>
          </div>
        </div>

        {/* Annual projection card */}
        <div className="card pad annual-card reveal reveal-2">
          <div className="annual-row">
            <div>
              <h2 className="sec">Your year at this pace</h2>
              <p className="annual-val">{annualTonnes} <span>tonnes CO2/yr</span></p>
            </div>
            <div className="tree-viz">
              <span className="tree-count">{treesNeeded}</span>
              <span className="tree-label">trees needed<br/>to offset</span>
            </div>
          </div>
          <div className="annual-bar-wrap">
            <div className="annual-bar">
              <div className="annual-fill you" style={{ width: `${Math.min((annualTonnes / 4.7) * 100, 100)}%` }} />
            </div>
            <div className="annual-marks">
              <span>You: {annualTonnes}t</span>
              <span>India avg: 2.0t</span>
              <span>World avg: 4.7t</span>
            </div>
          </div>
        </div>

        <section className="card pad reveal reveal-2" aria-labelledby="trend-heading">
          <div className="spread">
            <h2 id="trend-heading" className="sec">Last 7 days</h2>
            <span className="tinylabel">
              {daysUnder}/7 under India avg
            </span>
          </div>
          <div className="trend" role="img" aria-label={`7-day trend chart showing daily CO2 emissions. ${daysUnder} of 7 days under India average.`}>
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
        </section>

        <section className="card pad reveal reveal-3" aria-labelledby="gauge-heading">
          <div className="spread">
            <h2 id="gauge-heading" className="sec">Where you stand</h2>
            <span className="tinylabel">per person · per day</span>
          </div>
          <div className="gauge" role="img" aria-label={`Gauge showing your ${b.total} kg daily footprint relative to India average ${BENCHMARKS.india_avg} and world average ${BENCHMARKS.world_avg}`}>
            <div className="gauge-track">
              <div className="gauge-pin" style={{ left: `${pinPct}%` }} title={`You: ${b.total} kg`} />
            </div>
            <div className="gauge-marks">
              <div className="gauge-mark"><b>0</b>net-zero</div>
              <div className="gauge-mark" style={{ textAlign: "center" }}><b>{BENCHMARKS.india_avg}</b>India avg</div>
              <div className="gauge-mark" style={{ textAlign: "right" }}><b>{BENCHMARKS.world_avg}</b>World avg</div>
            </div>
          </div>
        </section>

        <div className="grid grid-2">
          <section className="card pad" aria-labelledby="breakdown-heading">
            <h2 id="breakdown-heading" className="sec">What it&apos;s made of</h2>
            <span className="tinylabel">kg CO2e / day, per person</span>
            <div style={{ marginTop: 14 }}>
              {categories.map((c) => (
                <div className="bar-row" key={c.key}>
                  <div className="bar-label">
                    <span className="swatch" style={{ background: CAT_COLORS[c.key] }} aria-hidden="true" />
                    {c.label}
                  </div>
                  <div className="bar-track" role="progressbar" aria-valuenow={c.val} aria-valuemin={0} aria-valuemax={round1(maxCatVal)} aria-label={`${c.label}: ${c.val} kg`}>
                    <div className="bar-fill" style={{ width: `${(c.val / maxCatVal) * 100}%`, background: CAT_COLORS[c.key] }} />
                  </div>
                  <span className="metric md">{c.val}</span>
                </div>
              ))}
            </div>
            <p className="tinylabel" style={{ marginTop: 14 }}>
              Diet is a daily baseline. Electricity &amp; cooking split across {profile.household} {profile.household > 1 ? "people" : "person"}.
            </p>
          </section>

          <Logger profile={profile} acts={acts} setActs={setActs} toast={toast} />
        </div>

        <section className="card pad" aria-labelledby="reco-heading">
          <div className="spread">
            <div>
              <h2 id="reco-heading" className="sec">Your biggest levers</h2>
              <span className="tinylabel">ranked by impact x feasibility — for YOUR footprint</span>
            </div>
          </div>
          <ol style={{ marginTop: 16, listStyle: "none", padding: 0 }} aria-label="Reduction recommendations">
            {recos.length === 0 && (
              <li><p className="empty">Log a few activities and your personalized reduction plan appears here.</p></li>
            )}
            {recos.map((r, i) => (
              <li className="reco" key={r.title}>
                <div className="reco-rank" aria-hidden="true">{String(i + 1).padStart(2, "0")}</div>
                <div className="reco-body">
                  <div className="reco-title">{r.title}</div>
                  <div className="reco-detail">{r.detail}</div>
                  <span className="chip" style={{ background: `${CAT_COLORS[r.category]}1a`, color: CAT_COLORS[r.category] }}>
                    {CAT_ICONS[r.category]} {r.category}
                  </span>
                </div>
                <div className="reco-save" aria-label={`Saves ${round1(r.saveKgDay)} kg per day`}>
                  <div className="n">-{round1(r.saveKgDay)}</div>
                  <div className="l">kg/day</div>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="card pad share-card" aria-labelledby="share-heading">
          <div className="share-inner">
            <div>
              <h2 id="share-heading" className="sec">Share your footprint</h2>
              <p className="lead" style={{ fontSize: 13 }}>Challenge your friends and family to track theirs</p>
            </div>
            <button className="btn ghost" aria-label="Share your carbon footprint" onClick={() => {
              const text = `My daily carbon footprint is ${b.total} kg CO2e (${annualTonnes} tonnes/yr). ${vsIndia <= 0 ? `That's ${Math.abs(vsIndia)} kg below the Indian average!` : `Trying to cut ${vsIndia} kg to match the Indian average.`} Track yours at prithvi-carbon.vercel.app`;
              if (navigator.share) {
                navigator.share({ title: "My Carbon Footprint — Prithvi", text }).catch(() => {});
              } else {
                navigator.clipboard.writeText(text).then(() => toast.show("Copied to clipboard!"));
              }
            }}>
              Share
            </button>
          </div>
        </section>
      </div>
    </section>
  );
}

/* ------------------------------- Logger ------------------------------- */
type LogTab = "electricity" | "commute" | "lpg" | "flight";

const TAB_LABELS: Record<LogTab, string> = {
  commute: "Commute",
  electricity: "Power",
  lpg: "Cooking",
  flight: "Flight",
};

const MAX_FILE_SIZE = 4.5 * 1024 * 1024;

interface LoggerProps {
  profile: Profile;
  acts: Activity[];
  setActs: (a: Activity[]) => void;
  toast: { show: (m: string) => void };
}

function Logger({ profile, acts, setActs, toast }: LoggerProps) {
  const [tab, setTab] = useState<LogTab>("commute");
  const [kwh, setKwh] = useState("");
  const [mode, setMode] = useState("petrol_car");
  const [km, setKm] = useState("");
  const [cyl, setCyl] = useState("");
  const [scanMsg, setScanMsg] = useState<string>("");
  const [scanning, setScanning] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  function add(partial: Omit<Activity, "id" | "kg">): number {
    const kg = computeActivityKg(partial, profile.state);
    const activity: Activity = { ...partial, id: uid(), kg };
    setActs([activity, ...acts].slice(0, ACTIVITY_MAX));
    return kg;
  }

  async function onScanFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) { setScanMsg("Image too large (max ~4.5 MB)."); return; }
    setScanning(true); setScanMsg("Gemini is reading your document...");
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
        setScanMsg(`Found ${r.kwh} kWh — review and tap Add.`);
        toast.show(`Gemini found ${r.kwh} kWh on your bill`);
      } else if (r.detected === "fuel" && r.litres) {
        const kg = add({ type: "fuel", date: today, litres: r.litres, fuel: r.fuel || "petrol", scanned: true });
        setScanMsg(`Logged ${r.litres} L ${r.fuel || "petrol"} (${kg} kg CO2).`);
        toast.show(`Scanned: ${r.litres} L ${r.fuel || "petrol"} = ${kg} kg CO2`);
      } else {
        setScanMsg(r.note || "Couldn't read that confidently. Enter it manually below.");
      }
    } catch {
      setScanMsg("Scan failed — check your connection or enter manually.");
    } finally { setScanning(false); }
  }

  function submit() {
    if (tab === "electricity" && +kwh > 0) {
      const kg = add({ type: "electricity", date: today, kwh: +kwh });
      toast.show(`Added ${kwh} kWh = ${kg} kg CO2`);
      setKwh("");
    }
    else if (tab === "commute" && +km > 0) {
      const kg = add({ type: "commute", date: today, mode, km: +km });
      toast.show(`Added ${km} km ${TRANSPORT_LABELS[mode]} = ${kg} kg CO2`);
      setKm("");
    }
    else if (tab === "flight" && +km > 0) {
      const kg = add({ type: "flight", date: today, mode: "domestic_flight", km: +km });
      toast.show(`Added ${km} km flight = ${kg} kg CO2`);
      setKm("");
    }
    else if (tab === "lpg" && +cyl > 0) {
      const kg = add({ type: "lpg", date: today, cylinders: +cyl });
      toast.show(`Added ${cyl} LPG cylinder = ${kg} kg CO2`);
      setCyl("");
    }
  }

  return (
    <div className="card pad">
      <h2 className="sec">Log activity</h2>
      <span className="tinylabel">computed live with your state&apos;s grid factor</span>

      <label className="scanbtn" style={{ marginTop: 12 }}>
        <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={onScanFile} disabled={scanning} aria-label="Upload electricity bill or fuel receipt for AI scanning" />
        {scanning ? (
          <>
            <span className="loading-spinner sm" role="status" aria-label="Scanning" />
            Gemini is reading...
          </>
        ) : (
          <>
            <span className="scan-ic" aria-hidden="true">&#128247;</span>
            Scan electricity bill or fuel receipt
          </>
        )}
        <span className="scan-tag" aria-hidden="true">AI</span>
      </label>
      {scanMsg && <p className="scan-msg" role="status" aria-live="polite">{scanMsg}</p>}

      <div className="seg" role="tablist" aria-label="Activity type" style={{ marginTop: 12 }}>
        {(["commute", "electricity", "lpg", "flight"] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      <div role="tabpanel" aria-label={`${TAB_LABELS[tab]} input`} style={{ marginTop: 14 }}>
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

      <ul style={{ marginTop: 16, listStyle: "none", padding: 0 }} aria-label="Activity log">
        {acts.length === 0
          ? <li><p className="empty" style={{ padding: "18px 0" }}>No activity yet. Add your commute to begin.</p></li>
          : acts.slice(0, 8).map((a) => (
            <li className="logitem" key={a.id}>
              <div>
                {labelOf(a)}
                <div className="meta">{a.date}{a.scanned ? " · scanned" : ""}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span className="metric md">{a.kg} <span className="unit">kg</span></span>
                <button className="del" onClick={() => { setActs(acts.filter((x) => x.id !== a.id)); toast.show("Entry removed"); }} aria-label={`Remove ${labelOf(a)}`}>
                  &times;
                </button>
              </div>
            </li>
          ))}
        {acts.length > 8 && (
          <li className="tinylabel" style={{ textAlign: "center", paddingTop: 8 }}>
            + {acts.length - 8} more entries
          </li>
        )}
      </ul>
    </div>
  );
}

function labelOf(a: Activity): string {
  if (a.type === "electricity") return `⚡ Electricity · ${a.kwh} kWh`;
  if (a.type === "lpg") return `🔥 Cooking · ${a.cylinders} cylinder${(a.cylinders ?? 0) > 1 ? "s" : ""}`;
  if (a.type === "flight") return `✈️ Flight · ${a.km} km`;
  if (a.type === "fuel") return `⛽ ${a.fuel === "diesel" ? "Diesel" : "Petrol"} · ${a.litres} L`;
  return `🚗 ${TRANSPORT_LABELS[a.mode ?? ""] ?? "Commute"} · ${a.km} km`;
}
