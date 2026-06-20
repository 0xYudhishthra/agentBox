"use client";

import Hover from "@/components/Hover";
import { st } from "@/lib/style";
import type { BotHubVals } from "@/lib/useBotHub";

/**
 * The Docker-Desktop-style runtime app window (sidebar + tabbed views + status
 * bar). Presentational — receives all data from a useBotHub() instance so it can
 * be dropped into the landing page or rendered standalone on its own route.
 */
export default function Dashboard({ v }: { v: BotHubVals }) {
  const { view } = v;
  return (
    <>
      {/* APP WINDOW */}
      <div style={st("border:1px solid #2A2A30;background:#0D0D0F;box-shadow:0 40px 90px -36px #000;")}>
        {/* title bar */}
        <div style={st("display:flex;align-items:center;padding:11px 16px;border-bottom:1px solid #2A2A30;background:#0A0A0C;")}>
          <div style={st("display:flex;gap:8px;")}>
            <span style={st("width:11px;height:11px;border-radius:50%;background:#2A2A30;")}></span>
            <span style={st("width:11px;height:11px;border-radius:50%;background:#2A2A30;")}></span>
            <span style={st("width:11px;height:11px;border-radius:50%;background:#2A2A30;")}></span>
          </div>
          <div style={st("flex:1;text-align:center;font-size:12px;color:#86868E;")}>BotHub — runtime</div>
          <div style={st("width:33px;")}></div>
        </div>

        <div style={st("display:flex;min-height:540px;")}>
          {/* SIDEBAR */}
          <div style={st("width:208px;flex:none;border-right:1px solid #2A2A30;background:#0A0A0C;display:flex;flex-direction:column;")}>
            <div style={st("padding:14px 14px 10px;")}>
              <div style={st("display:flex;align-items:center;gap:8px;background:#0D0D0F;border:1px solid #2A2A30;padding:7px 10px;font-size:12px;color:#56565E;")}>
                <span>⌕</span><span>Search…</span>
              </div>
            </div>
            <div style={st("padding:6px 8px;display:flex;flex-direction:column;gap:2px;")}>
              {v.nav.map((i, idx) => (
                <Hover key={idx} as="button" onClick={i.onClick} style={st(i.style)} hover={st(i.hover)}>
                  <span style={st("display:flex;align-items:center;gap:11px;")}>
                    <span style={st("font-size:12px;color:" + i.iconColor + ";width:14px;text-align:center;")}>{i.icon}</span>
                    <span>{i.label}</span>
                  </span>
                  <span style={st("font-size:11px;color:" + i.countColor + ";")}>{i.count}</span>
                </Hover>
              ))}
            </div>
            <div style={st("margin-top:auto;padding:14px;border-top:1px solid #2A2A30;")}>
              <div style={st("display:flex;align-items:center;gap:9px;font-size:11.5px;color:#B8B8C0;")}>
                <span style={st("width:7px;height:7px;border-radius:50%;background:#B5A8FF;animation:bh-pulse 2s ease-in-out infinite;")}></span>
                runtime · running
              </div>
              <div style={st("font-size:10.5px;color:#3A3A42;margin-top:6px;padding-left:16px;")}>v0.9.2 · gVisor</div>
            </div>
          </div>

          {/* MAIN */}
          <div style={st("flex:1;min-width:0;display:flex;flex-direction:column;")}>
            {/* toolbar */}
            <div style={st("display:flex;align-items:center;justify-content:space-between;gap:14px;padding:16px 20px;border-bottom:1px solid #2A2A30;")}>
              <div style={st("display:flex;align-items:baseline;gap:11px;")}>
                <span style={st("font-size:17px;font-weight:700;color:#FFFFFF;letter-spacing:-0.4px;")}>{view.title}</span>
                <span style={st("font-size:12px;color:#56565E;")}>{view.subtitle}</span>
              </div>
              {view.isSessions && (
                <Hover as="button" style={st("font-family:inherit;font-size:12px;font-weight:700;padding:8px 15px;border:1px solid #B5A8FF;background:#B5A8FF;color:#0D0D0F;cursor:pointer;")} hover={st("background:#8B7FD9;border-color:#8B7FD9;")}>+ Run session</Hover>
              )}
            </div>

            {/* SESSIONS VIEW */}
            {view.isSessions && (
              <div>
                <div style={st("display:grid;grid-template-columns:22px 1.5fr 124px 1.2fr 1.3fr 96px 104px;padding:11px 20px;border-bottom:1px solid #2A2A30;font-size:10px;color:#56565E;letter-spacing:0.5px;")}>
                  <div></div><div>NAME</div><div>STATE</div><div>GPU</div><div>MODEL · VRAM</div><div style={st("text-align:right;")}>COST</div><div></div>
                </div>
                {v.rows.map((s) => (
                  <Hover key={s.id as string} style={st("border-bottom:1px solid #202026;padding:13px 20px;")} hover={st("background:#101012;")}>
                    <div style={st("display:grid;grid-template-columns:22px 1.5fr 124px 1.2fr 1.3fr 96px 104px;align-items:center;")}>
                      <div><span style={st("display:inline-block;width:12px;height:12px;border:1px solid #2A2A30;")}></span></div>
                      <div style={st("min-width:0;")}>
                        <div style={st("font-size:13px;color:#E6E6E6;font-weight:500;")}>{s.id as string}</div>
                        <div style={st("font-size:11px;color:#56565E;margin-top:2px;")}>{s.name as string} · {s.provider as string}</div>
                      </div>
                      <div>
                        <span style={st("display:inline-flex;align-items:center;gap:6px;font-size:10.5px;font-weight:700;letter-spacing:0.3px;padding:3px 8px;color:" + s.stateColor + ";background:" + s.stateBg + ";border:1px solid " + s.stateBorder + ";")}>
                          <span style={st("width:5px;height:5px;border-radius:50%;background:" + s.dotColor + ";" + s.dotAnim)}></span>{s.stateLabel as string}
                        </span>
                      </div>
                      <div style={st("font-size:12.5px;")}>
                        <div style={st("color:" + s.gpuColor + ";font-weight:500;")}>{s.gpuLabel as string}</div>
                        <div style={st("font-size:10.5px;color:#56565E;margin-top:2px;")}>{s.gpuSub as string}</div>
                      </div>
                      <div style={st("padding-right:16px;")}>
                        <div style={st("font-size:12px;color:#B8B8C0;")}>{s.model as string}</div>
                        <div style={st("margin-top:5px;height:4px;background:#1A1A1E;overflow:hidden;")}>
                          <div style={st("height:100%;width:" + s.vramPct + "%;background:" + s.vramColor + ";transition:width .4s;")}></div>
                        </div>
                        <div style={st("font-size:10px;color:#56565E;margin-top:3px;")}>{s.vramLabel as string}</div>
                      </div>
                      <div style={st("text-align:right;")}>
                        <div style={st("font-size:13px;color:#FFFFFF;font-weight:700;")}>{s.costLabel as string}</div>
                        <div style={st("font-size:10px;color:" + s.costSubColor + ";margin-top:2px;")}>{s.costSub as string}</div>
                      </div>
                      <div style={st("text-align:right;")}>
                        <Hover as="button" onClick={s.onAction as () => void} disabled={s.btnDisabled as boolean} style={st(s.btnStyle as string)} hover={st(s.btnHover as string)}>{s.btnLabel as string}</Hover>
                      </div>
                    </div>
                    {(s.showBar as boolean) && (
                      <div style={st("margin-top:11px;display:flex;align-items:center;gap:12px;")}>
                        <span style={st("font-size:10.5px;color:#B5A8FF;white-space:nowrap;display:flex;align-items:center;gap:7px;")}>
                          <span style={st("display:inline-block;width:10px;height:10px;border:1.5px solid #B5A8FF;border-top-color:transparent;border-radius:50%;animation:bh-spin .7s linear infinite;")}></span>{s.barLabel as string}
                        </span>
                        <div style={st("flex:1;height:5px;background:#1A1A1E;overflow:hidden;")}>
                          <div style={st("height:100%;width:" + s.barPct + "%;background:linear-gradient(90deg,#8B7FD9,#B5A8FF);transition:width .15s linear;")}></div>
                        </div>
                        <span style={st("font-size:10.5px;color:#86868E;white-space:nowrap;")}>{s.barDetail as string}</span>
                      </div>
                    )}
                  </Hover>
                ))}
              </div>
            )}

            {/* CHECKPOINTS VIEW */}
            {view.isCheckpoints && (
              <div>
                <div style={st("display:grid;grid-template-columns:22px 1.7fr 1.4fr 1fr 110px;padding:11px 20px;border-bottom:1px solid #2A2A30;font-size:10px;color:#56565E;letter-spacing:0.5px;")}>
                  <div></div><div>CHECKPOINT</div><div>ORIGIN</div><div>SAVED</div><div></div>
                </div>
                {v.checkpoints.map((c, i) => (
                  <Hover key={i} style={st("border-bottom:1px solid #202026;padding:14px 20px;")} hover={st("background:#101012;")}>
                    <div style={st("display:grid;grid-template-columns:22px 1.7fr 1.4fr 1fr 110px;align-items:center;")}>
                      <div><span style={st("color:" + c.markColor + ";font-size:11px;")}>◆</span></div>
                      <div style={st("min-width:0;")}>
                        <div style={st("font-size:13px;color:#E6E6E6;font-weight:500;")}>{c.id}</div>
                        <div style={st("font-size:11px;color:#56565E;margin-top:2px;")}>{c.sub}</div>
                      </div>
                      <div style={st("font-size:12px;color:#B8B8C0;")}>{c.origin}</div>
                      <div style={st("font-size:12px;color:" + c.ageColor + ";")}>{c.age}</div>
                      <div style={st("text-align:right;")}>
                        <Hover as="button" onClick={c.onAction} disabled={c.disabled} style={st(c.btnStyle)} hover={st(c.btnHover)}>{c.btnLabel}</Hover>
                      </div>
                    </div>
                  </Hover>
                ))}
              </div>
            )}

            {/* GPUS VIEW */}
            {view.isGpus && (
              <div>
                <div style={st("display:grid;grid-template-columns:1.3fr 1.5fr 110px 90px 92px 1fr;padding:11px 20px;border-bottom:1px solid #2A2A30;font-size:10px;color:#56565E;letter-spacing:0.5px;")}>
                  <div>GPU</div><div>PROVIDER · REGION</div><div>STATUS</div><div>TEMP</div><div style={st("text-align:right;")}>$/HR</div><div style={st("text-align:right;")}>SESSION</div>
                </div>
                {v.gpus.map((g, i) => (
                  <Hover key={i} style={st("border-bottom:1px solid #202026;padding:14px 20px;")} hover={st("background:#101012;")}>
                    <div style={st("display:grid;grid-template-columns:1.3fr 1.5fr 110px 90px 92px 1fr;align-items:center;")}>
                      <div style={st("font-size:13px;color:" + g.gpuColor + ";font-weight:500;")}>{g.gpu}</div>
                      <div style={st("font-size:12px;color:#B8B8C0;")}>{g.host}</div>
                      <div>
                        <span style={st("font-size:10.5px;font-weight:700;letter-spacing:0.3px;color:" + g.statusColor + ";")}>{g.status}</span>
                      </div>
                      <div style={st("font-size:12.5px;color:" + g.tempColor + ";")}>{g.temp}</div>
                      <div style={st("font-size:12.5px;color:#B8B8C0;text-align:right;")}>{g.rate}</div>
                      <div style={st("font-size:12px;color:#86868E;text-align:right;")}>{g.session}</div>
                    </div>
                  </Hover>
                ))}
              </div>
            )}

            {/* PROVIDERS VIEW */}
            {view.isProviders && (
              <div>
                <div style={st("display:grid;grid-template-columns:1.3fr 1.7fr 100px 100px 120px;padding:11px 20px;border-bottom:1px solid #2A2A30;font-size:10px;color:#56565E;letter-spacing:0.5px;")}>
                  <div>PROVIDER</div><div>REGIONS</div><div style={st("text-align:right;")}>SPOT</div><div style={st("text-align:right;")}>ACTIVE</div><div style={st("text-align:right;")}>STATUS</div>
                </div>
                {v.providers.map((p, i) => (
                  <Hover key={i} style={st("border-bottom:1px solid #202026;padding:16px 20px;")} hover={st("background:#101012;")}>
                    <div style={st("display:grid;grid-template-columns:1.3fr 1.7fr 100px 100px 120px;align-items:center;")}>
                      <div style={st("font-size:13px;color:#E6E6E6;font-weight:600;")}>{p.name}</div>
                      <div style={st("font-size:12px;color:#86868E;")}>{p.regions}</div>
                      <div style={st("font-size:12.5px;color:#B8B8C0;text-align:right;")}>{p.rate}</div>
                      <div style={st("font-size:12.5px;color:#B5A8FF;font-weight:700;text-align:right;")}>{p.active}</div>
                      <div style={st("text-align:right;font-size:10.5px;color:#86868E;letter-spacing:0.3px;")}>{p.status}</div>
                    </div>
                  </Hover>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* status bar */}
        <div style={st("display:flex;align-items:center;gap:20px;padding:8px 18px;border-top:1px solid #2A2A30;background:#0A0A0C;font-size:11px;color:#86868E;flex-wrap:wrap;")}>
          <span style={st("display:flex;align-items:center;gap:7px;color:#B5A8FF;")}><span style={st("width:6px;height:6px;border-radius:50%;background:#B5A8FF;")}></span>Engine running</span>
          <span>CPU {v.stat.cpu}</span>
          <span>MEM {v.stat.mem}</span>
          <span style={st("color:#B8B8C0;")}>GPU <span style={st("color:#B5A8FF;")}>{v.stat.hot} hot</span> · {v.stat.cold} cold</span>
          <span style={st("margin-left:auto;color:#3A3A42;")}>v0.9.2</span>
        </div>
      </div>
      <div style={st("font-size:12px;color:#56565E;margin-top:14px;")}>click <span style={st("color:#B5A8FF;")}>pause</span> to checkpoint &amp; release the GPU — or switch tabs in the sidebar.</div>
    </>
  );
}
