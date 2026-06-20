"use client";

import { useEffect, useRef, useState } from "react";

/* ── Palette (ported from DCLogic.C) ─────────────────────────────────────── */
const C = {
  lav: "#B5A8FF",
  lav2: "#8B7FD9",
  lavBg: "rgba(181,168,255,0.08)",
  lavBorder: "rgba(181,168,255,0.24)",
  gray: "#86868E",
  dim: "#56565E",
  text: "#E6E6E6",
  surf: "rgba(255,255,255,0.03)",
  border: "#2A2A30",
};

const durs: Record<string, number> = {
  RUNNING: 2800,
  CHECKPOINTING: 2400,
  COLD: 3000,
  RESUMING: 1900,
};
const order = ["RUNNING", "CHECKPOINTING", "COLD", "RESUMING"];

const lerp = (a: number, b: number, t: number) =>
  a + (b - a) * Math.min(1, Math.max(0, t));
const fmtAge = (min: number) =>
  min >= 1440
    ? Math.round(min / 1440) + "d ago"
    : min >= 60
      ? Math.floor(min / 60) + "h " + (min % 60) + "m ago"
      : min + "m ago";

export type SessionState =
  | "RUNNING"
  | "CHECKPOINTING"
  | "CHECKPOINTED"
  | "RESUMING"
  | "PAUSED";

export interface Session {
  id: string;
  name: string;
  brain: string;
  model: string;
  sizeGB: number;
  st: SessionState;
  gpu: string;
  vramUsed: number;
  provider: string;
  region: string;
  rate: number;
  cost: number;
  temp: number;
  cp: number;
  cpAge: number;
}

interface Demo {
  phase: string;
  t: number;
  cost: number;
}

const initialSessions: Session[] = [
  { id: "sess_8f3a", name: "refactor-monolith", brain: "claude", model: "llama-3.3-70b", sizeGB: 50, st: "RUNNING", gpu: "H100 80GB", vramUsed: 50, provider: "Vast.ai", region: "us-east-1", rate: 0.54, cost: 3.2148, temp: 71, cp: 0, cpAge: 0 },
  { id: "sess_2c91", name: "eval-sweep", brain: "llama", model: "qwen2.5-32b", sizeGB: 22, st: "RUNNING", gpu: "A100 40GB", vramUsed: 22, provider: "RunPod", region: "eu-west-4", rate: 0.39, cost: 1.0772, temp: 64, cp: 0, cpAge: 0 },
  { id: "sess_d70b", name: "doc-indexer", brain: "script", model: "mixtral-8x7b", sizeGB: 48, st: "CHECKPOINTED", gpu: "H100 80GB", vramUsed: 48, provider: "Hyperbolic", region: "us-west-2", rate: 0.0, cost: 12.884, temp: 0, cp: 48, cpAge: 128 },
  { id: "sess_4e12", name: "web-scraper", brain: "claude", model: "llama-3.1-8b", sizeGB: 7, st: "PAUSED", gpu: "A100 40GB", vramUsed: 0, provider: "RunPod", region: "us-east-1", rate: 0.12, cost: 0.441, temp: 41, cp: 0, cpAge: 0 },
  { id: "sess_a55f", name: "fine-tune-runner", brain: "script", model: "llama-3.3-70b", sizeGB: 64, st: "RUNNING", gpu: "H100 80GB", vramUsed: 64, provider: "Hyperbolic", region: "ap-south-1", rate: 0.61, cost: 7.9305, temp: 76, cp: 0, cpAge: 0 },
  { id: "sess_91c4", name: "nightly-bench", brain: "llama", model: "gemma-2-27b", sizeGB: 19, st: "CHECKPOINTED", gpu: "A100 40GB", vramUsed: 19, provider: "Vast.ai", region: "eu-west-4", rate: 0.0, cost: 5.6012, temp: 0, cp: 19, cpAge: 42 },
];

/* ── Pure builders (ported from DCLogic) ─────────────────────────────────── */
function buildDemo(demo: Demo) {
  const { phase: p, t, cost: demoCost } = demo;
  const labels: Record<string, string> = {
    RUNNING: "RUNNING",
    CHECKPOINTING: "CHECKPOINTING",
    COLD: "CHECKPOINTED · COLD",
    RESUMING: "RESUMING",
  };
  let temp: number,
    vramPct: number,
    vramLabel: string,
    rateLabel: string,
    rate0: boolean,
    status: string,
    stepLabel: string,
    stepLav: boolean,
    barColor: string;
  if (p === "RUNNING") {
    temp = 70 + Math.round(Math.sin(t * 9) * 2);
    vramPct = 100;
    vramLabel = "50 / 50 GB";
    rate0 = false;
    rateLabel = "$0.54/hr";
    barColor = C.lav;
    status = "executing — writing tests for the payments module · step 412";
    stepLabel = "step 412";
    stepLav = false;
  } else if (p === "CHECKPOINTING") {
    temp = Math.round(lerp(70, 34, t));
    const g = lerp(50, 0, t);
    vramPct = (g / 50) * 100;
    vramLabel = (50 - g).toFixed(1) + " GB → store";
    rate0 = false;
    rateLabel = "$0.54/hr";
    barColor = C.lav;
    status = "freezing VRAM + live memory · CRIU + cuda-checkpoint";
    stepLabel = "step 412 · held";
    stepLav = true;
  } else if (p === "COLD") {
    temp = 0;
    vramPct = 0;
    vramLabel = "0 GB · on disk";
    rate0 = true;
    rateLabel = "$0.00/hr";
    barColor = C.dim;
    status = "GPU released · billing stopped · checkpoint safe on object store";
    stepLabel = "step 412 · saved";
    stepLav = true;
  } else {
    temp = Math.round(lerp(8, 70, t));
    vramPct = t * 100;
    vramLabel = "restoring " + (t * 50).toFixed(1) + " GB";
    rate0 = false;
    rateLabel = "$0.54/hr";
    barColor = C.lav;
    status = "rehydrating process + VRAM onto a fresh H100 on Vast.ai";
    stepLabel = "step 412 · restored";
    stepLav = true;
  }
  const nodes = order.map((ph) => {
    const active = ph === p;
    return {
      label: ph === "COLD" ? "CHECKPOINTED" : ph,
      ring: active ? C.lav : "#2A2A30",
      fill: active ? C.lav : "transparent",
      text: active ? C.lav : C.dim,
      anim: active ? "animation:bh-pulse 1.6s ease-in-out infinite;" : "",
    };
  });
  return {
    phaseLabel: labels[p],
    phaseColor: p === "COLD" ? C.gray : C.lav,
    liveDot: p === "COLD" ? C.dim : C.lav,
    liveAnim: p === "COLD" ? "" : "animation:bh-pulse 1.6s ease-in-out infinite;",
    nodes,
    barPct: Math.round(t * 100),
    barColor,
    status,
    tempLabel: temp === 0 ? "— °C" : temp + " °C",
    tempColor: temp === 0 ? C.gray : temp > 50 ? C.lav : C.text,
    vramLabel,
    vramPct,
    vramColor: vramPct > 0 ? "#FFFFFF" : C.gray,
    rateLabel,
    rateColor: rate0 ? C.gray : C.lav,
    costLabel: "$" + demoCost.toFixed(2),
    stepLabel,
    stepColor: stepLav ? C.lav : "#FFFFFF",
  };
}

function buildRow(s: Session, action: (id: string) => void) {
  const v: Record<string, unknown> = {
    id: s.id,
    name: s.name,
    brain: s.brain,
    model: s.model,
    provider: s.provider,
    region: s.region,
  };
  const stateMap: Record<string, { label: string; color: string; bg: string; border: string; dot: string; anim: string }> = {
    RUNNING: { label: "RUNNING", color: C.lav, bg: C.lavBg, border: C.lavBorder, dot: C.lav, anim: "animation:bh-pulse 1.8s ease-in-out infinite;" },
    CHECKPOINTING: { label: "CHECKPOINTING", color: C.lav, bg: C.lavBg, border: C.lavBorder, dot: C.lav, anim: "animation:bh-pulse .9s ease-in-out infinite;" },
    CHECKPOINTED: { label: "CHECKPOINTED", color: C.lav, bg: C.lavBg, border: C.lavBorder, dot: C.lav, anim: "" },
    RESUMING: { label: "RESUMING", color: C.lav, bg: C.lavBg, border: C.lavBorder, dot: C.lav, anim: "animation:bh-pulse .9s ease-in-out infinite;" },
    PAUSED: { label: "PAUSED", color: C.gray, bg: C.surf, border: C.border, dot: C.dim, anim: "" },
  };
  const m = stateMap[s.st];
  v.stateLabel = m.label;
  v.stateColor = m.color;
  v.stateBg = m.bg;
  v.stateBorder = m.border;
  v.dotColor = m.dot;
  v.dotAnim = m.anim;
  const hot = s.st === "RUNNING" || s.st === "CHECKPOINTING";
  v.gpuLabel = s.gpu;
  v.gpuColor = hot ? C.lav : C.gray;
  v.gpuSub = hot ? s.temp + "°C · HOT" : s.st === "PAUSED" ? "idle · held" : "— · COLD";
  v.vramPct = (s.vramUsed / s.sizeGB) * 100;
  v.vramColor = s.vramUsed > 0 ? (hot ? C.lav2 : "#3A3A42") : "#2A2A30";
  if (s.st === "CHECKPOINTED") v.vramLabel = s.sizeGB + " GB on disk";
  else if (s.st === "PAUSED") v.vramLabel = "released";
  else v.vramLabel = s.vramUsed.toFixed(0) + " / " + s.sizeGB + " GB";
  v.rateLabel = "$" + s.rate.toFixed(2) + "/hr";
  v.costLabel = "$" + s.cost.toFixed(s.cost < 100 ? 4 : 2);
  if (s.st === "RUNNING") {
    v.costSub = "accruing";
    v.costSubColor = C.gray;
  } else if (s.st === "CHECKPOINTED") {
    v.costSub = "frozen";
    v.costSubColor = C.lav;
  } else if (s.st === "CHECKPOINTING") {
    v.costSub = "stopping…";
    v.costSubColor = C.gray;
  } else if (s.st === "RESUMING") {
    v.costSub = "resuming";
    v.costSubColor = C.gray;
  } else {
    v.costSub = "idle";
    v.costSubColor = C.dim;
  }
  v.showBar = s.st === "CHECKPOINTING" || s.st === "RESUMING";
  if (v.showBar) {
    v.barPct = Math.round((s.cp / s.sizeGB) * 100);
    if (s.st === "CHECKPOINTING") {
      v.barLabel = "freezing VRAM";
      v.barDetail = s.cp.toFixed(1) + " / " + s.sizeGB + " GB → store";
    } else {
      v.barLabel = "restoring";
      v.barDetail = s.cp.toFixed(1) + " / " + s.sizeGB + " GB";
    }
  } else {
    v.barPct = 0;
    v.barLabel = "";
    v.barDetail = "";
  }
  const base = "font-family:inherit;font-size:11.5px;font-weight:700;padding:6px 12px;border:1px solid;cursor:pointer;letter-spacing:0.2px;";
  if (s.st === "RUNNING") {
    v.btnLabel = "pause";
    v.btnDisabled = false;
    v.btnStyle = base + "background:transparent;border-color:" + C.lavBorder + ";color:" + C.lav + ";";
    v.btnHover = "background:" + C.lav + ";color:#0D0D0F;border-color:" + C.lav + ";";
  } else if (s.st === "CHECKPOINTED" || s.st === "PAUSED") {
    v.btnLabel = "resume";
    v.btnDisabled = false;
    v.btnStyle = base + "background:" + C.lav + ";border-color:" + C.lav + ";color:#0D0D0F;";
    v.btnHover = "background:" + C.lav2 + ";border-color:" + C.lav2 + ";";
  } else {
    v.btnLabel = s.st === "CHECKPOINTING" ? "saving…" : "resuming…";
    v.btnDisabled = true;
    v.btnStyle = base + "background:transparent;border-color:#2A2A30;color:#56565E;cursor:default;";
    v.btnHover = "";
  }
  v.onAction = () => action(s.id);
  return v;
}

function buildCheckpoints(sessions: Session[], action: (id: string) => void) {
  const ghost = "font-family:inherit;font-size:11.5px;font-weight:700;padding:6px 12px;border:1px solid #2A2A30;background:transparent;color:#E6E6E6;cursor:pointer;";
  const live = sessions
    .filter((s) => s.st === "CHECKPOINTED")
    .map((s) => ({
      id: s.id,
      sub: s.model + " · " + s.sizeGB + " GB",
      origin: s.gpu + " · " + s.provider,
      age: fmtAge(s.cpAge),
      ageColor: C.lav,
      markColor: C.lav,
      disabled: false,
      btnLabel: "resume",
      btnStyle: "font-family:inherit;font-size:11.5px;font-weight:700;padding:6px 12px;border:1px solid " + C.lav + ";background:" + C.lav + ";color:#0D0D0F;cursor:pointer;",
      btnHover: "background:" + C.lav2 + ";border-color:" + C.lav2 + ";",
      onAction: () => action(s.id),
    }));
  const archived = [
    { id: "sess_8f3a@step340", sub: "llama-3.3-70b · 50 GB", origin: "H100 · Vast.ai", age: "3d ago" },
    { id: "sess_a55f@step1024", sub: "llama-3.3-70b · 64 GB", origin: "H100 · Hyperbolic", age: "6d ago" },
    { id: "sess_2c91@step88", sub: "qwen2.5-32b · 22 GB", origin: "A100 · RunPod", age: "9d ago" },
  ].map((a) => ({
    ...a,
    ageColor: C.gray,
    markColor: "#56565E",
    disabled: false,
    btnLabel: "restore",
    btnStyle: ghost,
    btnHover: "border-color:#8B7FD9;color:#B5A8FF;",
    onAction: () => {},
  }));
  return live.concat(archived);
}

function buildGpus(sessions: Session[]) {
  const fromSessions = sessions.map((s) => {
    const hot = s.st === "RUNNING" || s.st === "CHECKPOINTING";
    const status = hot ? "HOT" : s.st === "PAUSED" ? "IDLE" : "COLD";
    return {
      gpu: s.gpu,
      gpuColor: hot ? C.lav : C.gray,
      host: s.provider + " · " + s.region,
      status,
      statusColor: hot ? C.lav : C.gray,
      temp: hot ? s.temp + " °C" : s.st === "PAUSED" ? s.temp + " °C" : "— °C",
      tempColor: hot ? C.lav : C.gray,
      rate: "$" + (hot ? (s.gpu === "H100 80GB" ? 0.54 : 0.39) : 0).toFixed(2),
      session: s.id,
    };
  });
  fromSessions.push({ gpu: "H100 80GB", gpuColor: C.gray, host: "RunPod · us-east-1", status: "AVAILABLE", statusColor: C.gray, temp: "— °C", tempColor: C.gray, rate: "$0.50", session: "—" });
  return fromSessions;
}

/* ── Hook ─────────────────────────────────────────────────────────────────── */
export function useBotHub() {
  const [sessions, setSessions] = useState<Session[]>(initialSessions);
  const [demo, setDemo] = useState<Demo>({ phase: "RUNNING", t: 0, cost: 3.2148 });
  const [tab, setTab] = useState("sessions");
  const [copied, setCopied] = useState(false);

  const sessionsRef = useRef(sessions);
  useEffect(() => {
    sessionsRef.current = sessions;
  });
  const timers = useRef<Record<string, ReturnType<typeof setInterval>>>({});
  const last = useRef(0);

  useEffect(() => {
    last.current = typeof performance !== "undefined" ? performance.now() : 0;
    const demoTimer = setInterval(() => {
      const now = performance.now();
      const dt = now - last.current;
      last.current = now;
      setDemo((d) => {
        let { phase, t, cost } = d;
        const dur = durs[phase];
        t += dt / dur;
        if (phase !== "COLD") cost += 0.54 * (dt / 3600000) * 90;
        if (t >= 1) {
          t = 0;
          phase = order[(order.indexOf(phase) + 1) % 4];
        }
        return { phase, t, cost };
      });
    }, 60);
    const billTimer = setInterval(() => {
      setSessions((prev) =>
        prev.map((x) => (x.st === "RUNNING" ? { ...x, cost: x.cost + x.rate / 3600 } : x)),
      );
    }, 1000);
    const localTimers = timers.current;
    return () => {
      clearInterval(demoTimer);
      clearInterval(billTimer);
      Object.values(localTimers).forEach(clearInterval);
    };
  }, []);

  const setSt = (id: string, patch: Partial<Session>) =>
    setSessions((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const startCheckpoint = (id: string) => {
    setSt(id, { st: "CHECKPOINTING", cp: 0 });
    const target = sessionsRef.current.find((x) => x.id === id)!.sizeGB;
    if (timers.current[id]) clearInterval(timers.current[id]);
    timers.current[id] = setInterval(() => {
      const cur = sessionsRef.current.find((x) => x.id === id);
      if (!cur) return;
      const next = cur.cp + target / 26;
      if (next >= target) {
        clearInterval(timers.current[id]);
        delete timers.current[id];
        setSt(id, { st: "CHECKPOINTED", cp: target, rate: 0, temp: 0, vramUsed: 0, cpAge: 0 });
      } else {
        setSt(id, { cp: next, temp: Math.max(8, cur.temp - 3) });
      }
    }, 95);
  };

  const startResume = (id: string) => {
    const cur0 = sessionsRef.current.find((x) => x.id === id)!;
    const target = cur0.sizeGB;
    const rate = ({ "H100 80GB": 0.54, "A100 40GB": 0.39 } as Record<string, number>)[cur0.gpu] || 0.42;
    setSt(id, { st: "RESUMING", cp: 0 });
    if (timers.current[id]) clearInterval(timers.current[id]);
    timers.current[id] = setInterval(() => {
      const c = sessionsRef.current.find((x) => x.id === id);
      if (!c) return;
      const next = c.cp + target / 16;
      if (next >= target) {
        clearInterval(timers.current[id]);
        delete timers.current[id];
        setSt(id, { st: "RUNNING", cp: 0, rate, temp: cur0.gpu === "H100 80GB" ? 71 : 64, vramUsed: target });
      } else {
        setSt(id, { cp: next, vramUsed: next, temp: Math.min(70, 20 + next) });
      }
    }, 95);
  };

  const action = (id: string) => {
    const s = sessionsRef.current.find((x) => x.id === id);
    if (!s) return;
    if (s.st === "RUNNING") startCheckpoint(id);
    else if (s.st === "CHECKPOINTED" || s.st === "PAUSED") startResume(id);
  };

  const copyInstall = () => {
    try {
      navigator.clipboard.writeText("curl -fsSL bothub.dev/install | sh");
    } catch {}
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  /* ── renderVals (ported) ─────────────────────────────────────────────── */
  const ss = sessions;
  const running = ss.filter((x) => x.st === "RUNNING").length;
  const hot = ss.filter((x) => x.st === "RUNNING" || x.st === "CHECKPOINTING").length;
  const checkpoints = buildCheckpoints(ss, action);
  const gpus = buildGpus(ss);
  const providers = [
    { name: "Vast.ai", regions: "us-east · eu-west", rate: "$0.50/hr", active: "2", status: "CONNECTED" },
    { name: "RunPod", regions: "eu-west · us-east", rate: "$0.39/hr", active: "1", status: "CONNECTED" },
    { name: "Hyperbolic", regions: "us-west · ap-south", rate: "$0.61/hr", active: "2", status: "CONNECTED" },
  ];
  const counts: Record<string, number> = {
    sessions: ss.length,
    checkpoints: checkpoints.length,
    gpus: gpus.length,
    providers: providers.length,
  };
  const navDefs = [
    { key: "sessions", label: "Sessions", icon: "▣" },
    { key: "checkpoints", label: "Checkpoints", icon: "◆" },
    { key: "gpus", label: "GPUs", icon: "▤" },
    { key: "providers", label: "Providers", icon: "◇" },
  ];
  const nav = navDefs.map((d) => {
    const active = tab === d.key;
    const itemBase = "width:100%;display:flex;align-items:center;justify-content:space-between;font-family:inherit;font-size:13px;padding:9px 11px;border:0;border-left:2px solid;cursor:pointer;text-align:left;";
    return {
      label: d.label,
      icon: d.icon,
      count: counts[d.key],
      onClick: () => setTab(d.key),
      iconColor: active ? C.lav : C.gray,
      countColor: active ? C.lav : "#56565E",
      style:
        itemBase +
        (active
          ? "background:rgba(181,168,255,0.07);border-left-color:#B5A8FF;color:#FFFFFF;font-weight:600;"
          : "background:transparent;border-left-color:transparent;color:#86868E;font-weight:400;"),
      hover: active ? "" : "background:#101012;color:#E6E6E6;",
    };
  });
  const titles: Record<string, { title: string; subtitle: string }> = {
    sessions: { title: "Sessions", subtitle: running + " running · " + (ss.length - running) + " idle" },
    checkpoints: { title: "Checkpoints", subtitle: checkpoints.length + " saved · 1.2 TB" },
    gpus: { title: "GPUs", subtitle: hot + " hot · " + (gpus.length - hot) + " cold" },
    providers: { title: "Providers", subtitle: "3 connected" },
  };
  const view = {
    title: titles[tab].title,
    subtitle: titles[tab].subtitle,
    isSessions: tab === "sessions",
    isCheckpoints: tab === "checkpoints",
    isGpus: tab === "gpus",
    isProviders: tab === "providers",
  };
  const tierBtn = (variant: string) => {
    const base = "width:100%;font-family:inherit;font-size:13px;font-weight:700;padding:10px 0;cursor:pointer;letter-spacing:0.2px;";
    if (variant === "primary")
      return { style: base + "background:#B5A8FF;border:1px solid #B5A8FF;color:#0D0D0F;", hover: "background:#8B7FD9;border-color:#8B7FD9;" };
    return { style: base + "background:transparent;border:1px solid #2A2A30;color:#E6E6E6;", hover: "border-color:#8B7FD9;color:#B5A8FF;" };
  };
  const feat = (text: string, on: boolean) => ({ text, mark: on ? "◆" : "·", markColor: on ? C.lav : C.dim });
  const ghost = tierBtn("ghost");
  const prim = tierBtn("primary");

  return {
    copyLabel: copied ? "copied ✓" : "copy",
    copyColor: copied ? C.lav : C.gray,
    copyInstall,
    demo: buildDemo(demo),
    nav,
    view,
    checkpoints,
    gpus,
    providers,
    rows: ss.map((s) => buildRow(s, action)),
    stat: { cpu: "12%", mem: "6.2 / 32 GB", hot: hot, cold: gpus.length - hot },
    problems: [
      { n: "01", label: "No state", line: "every session is a cold start." },
      { n: "02", label: "Infra lock-in", line: "managed cloud at ~$4/hr. Their box or nothing." },
      { n: "03", label: "Brain lock-in", line: "a proprietary planner you can’t swap." },
    ],
    solutions: [
      { n: "01", numColor: C.lav, labelColor: C.lav, label: "Stateful", line: "freeze VRAM + memory. Resume the same step, anywhere." },
      { n: "02", numColor: C.dim, labelColor: "#FFFFFF", label: "Cheap", line: "spot metal at ~$0.50/hr, gVisor-isolated." },
      { n: "03", numColor: C.dim, labelColor: "#FFFFFF", label: "Open", line: "Claude, Llama, or your script. The sandbox, not the brain." },
    ],
    tiers: [
      { name: "OPEN SOURCE", nameColor: C.gray, recommended: false, border: "#2A2A30", cardBg: "#0A0A0C", price: "$0", unit: "/ forever", cta: "clone the repo", btnStyle: ghost.style, btnHover: ghost.hover, features: [feat("Full runtime · CRIU + cuda-checkpoint", true), feat("gVisor isolation", false), feat("MCP · any brain", false), feat("Community Discord", false)] },
      { name: "PRO", nameColor: C.lav, recommended: true, border: "#B5A8FF", cardBg: "rgba(181,168,255,0.04)", price: "$40", unit: "/ seat · mo", cta: "start free trial", btnStyle: prim.style, btnHover: prim.hover, features: [feat("Everything in OSS", false), feat("Managed checkpoint store", true), feat("Spot orchestration", true), feat("Priority warm-resume", true)] },
      { name: "ENTERPRISE", nameColor: C.gray, recommended: false, border: "#2A2A30", cardBg: "#0A0A0C", price: "Let’s talk", unit: "", cta: "contact sales", btnStyle: ghost.style, btnHover: ghost.hover, features: [feat("SSO · SAML", false), feat("Private compute pools", false), feat("Audit logs + SLA", false), feat("Dedicated support", false)] },
    ],
  };
}

export type BotHubVals = ReturnType<typeof useBotHub>;
