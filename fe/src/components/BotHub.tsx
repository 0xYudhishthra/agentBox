"use client";

import Link from "next/link";

import Dashboard from "@/components/Dashboard";
import Hover from "@/components/Hover";
import { st } from "@/lib/style";
import { useBotHub } from "@/lib/useBotHub";

export default function BotHub() {
  const v = useBotHub();
  const { demo, view } = v;

  return (
    <div style={st("min-height:100vh;background:#0D0D0F;overflow-x:hidden;")}>
      {/* NAV */}
      <div style={st("position:sticky;top:0;z-index:50;backdrop-filter:blur(10px);background:rgba(13,13,15,0.82);border-bottom:1px solid #2A2A30;")}>
        <div style={st("max-width:1180px;margin:0 auto;padding:0 32px;height:58px;display:flex;align-items:center;justify-content:space-between;")}>
          <a href="#top" style={st("display:inline-flex;align-items:center;font-weight:800;font-size:19px;letter-spacing:-1px;text-decoration:none;")}>
            <span style={st("color:#FFFFFF;")}>Bot</span>
            <span style={st("background:#B5A8FF;color:#0D0D0F;padding:1px 7px 2px;border-radius:4px;margin-left:2px;")}>Hub</span>
          </a>
          <div style={st("display:flex;align-items:center;gap:26px;font-size:13px;color:#86868E;")}>
            <Hover as="a" href="#problem" style={st("color:#86868E;text-decoration:none;")} hover={st("color:#E6E6E6;")}>why</Hover>
            <Hover as="a" href="#try" style={st("color:#86868E;text-decoration:none;")} hover={st("color:#E6E6E6;")}>try</Hover>
            <Hover as="a" href="#pricing" style={st("color:#86868E;text-decoration:none;")} hover={st("color:#E6E6E6;")}>pricing</Hover>
            <Hover as="a" href="#" style={st("color:#86868E;text-decoration:none;display:flex;gap:6px;align-items:center;")} hover={st("color:#E6E6E6;")}><span>★</span>9.4k</Hover>
            <Hover as={Link} href="/dashboard" style={st("text-decoration:none;color:#0D0D0F;background:#B5A8FF;font-weight:700;padding:7px 15px;font-size:13px;")} hover={st("background:#8B7FD9;")}>try it</Hover>
          </div>
        </div>
      </div>

      {/* HERO */}
      <div id="top" style={st("max-width:1180px;margin:0 auto;padding:76px 32px 0;")}>
        <div style={st("display:flex;align-items:center;gap:14px;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#56565E;margin-bottom:30px;")}>
          <span style={st("width:8px;height:8px;background:#B5A8FF;animation:bh-pulse 1.8s ease-in-out infinite;")}></span>
          00 — runtime
          <span style={st("flex:1;height:1px;background:#2A2A30;")}></span>
        </div>
        <h1 style={st("font-size:clamp(38px,5.4vw,66px);line-height:1.05;letter-spacing:-2.4px;font-weight:800;margin:0;color:#FFFFFF;")}>
          Pause the agent.<br />Kill the GPU.<br /><span style={st("color:#B5A8FF;")}>Resume next week.</span>
        </h1>
        <div style={st("display:flex;align-items:flex-end;justify-content:space-between;gap:30px;flex-wrap:wrap;margin-top:34px;")}>
          <p style={st("font-size:15px;line-height:1.5;color:#B8B8C0;margin:0;")}>
            Ephemeral in billing.<br /><span style={st("color:#FFFFFF;")}>Stateful in execution.</span>
          </p>
          <div style={st("display:flex;align-items:stretch;gap:12px;flex-wrap:wrap;")}>
            <div style={st("display:flex;align-items:center;background:#08080A;border:1px solid #2A2A30;font-size:13.5px;")}>
              <span style={st("padding:12px 15px;color:#E6E6E6;white-space:nowrap;")}><span style={st("color:#56565E;")}>$ </span>curl -fsSL bothub.dev/install | sh</span>
              <Hover as="button" onClick={v.copyInstall} style={st("border:0;border-left:1px solid #2A2A30;background:transparent;color:" + v.copyColor + ";font-family:inherit;font-size:12px;padding:0 14px;align-self:stretch;cursor:pointer;")} hover={st("color:#B5A8FF;")}>{v.copyLabel}</Hover>
            </div>
            <Hover as="a" href="#try" style={st("display:flex;align-items:center;white-space:nowrap;text-decoration:none;color:#0D0D0F;background:#B5A8FF;font-weight:700;padding:0 22px;font-size:13.5px;")} hover={st("background:#8B7FD9;")}>try the console →</Hover>
          </div>
        </div>
      </div>

      {/* SIGNATURE: live session lifecycle band */}
      <div style={st("max-width:1180px;margin:52px auto 0;padding:0 32px;")}>
        <div style={st("border:1px solid #2A2A30;background:#0A0A0C;")}>
          <div style={st("display:flex;align-items:center;justify-content:space-between;padding:13px 20px;border-bottom:1px solid #2A2A30;")}>
            <div style={st("display:flex;align-items:center;gap:10px;font-size:12px;color:#86868E;")}>
              <span style={st("width:7px;height:7px;background:" + demo.liveDot + ";" + demo.liveAnim)}></span>
              sess_8f3a · <span style={st("color:#56565E;")}>brain:claude</span>
            </div>
            <div style={st("font-size:12px;color:" + demo.phaseColor + ";font-weight:700;letter-spacing:0.4px;")}>{demo.phaseLabel}</div>
          </div>
          <div style={st("padding:34px 30px 28px;")}>
            <div style={st("position:relative;display:flex;justify-content:space-between;align-items:center;")}>
              <div style={st("position:absolute;left:6%;right:6%;top:6px;height:1px;background:#2A2A30;")}></div>
              {demo.nodes.map((n, i) => (
                <div key={i} style={st("position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;gap:12px;flex:1;")}>
                  <span style={st("width:13px;height:13px;border:1.5px solid " + n.ring + ";background:" + n.fill + ";" + n.anim)}></span>
                  <span style={st("font-size:11px;letter-spacing:0.4px;color:" + n.text + ";white-space:nowrap;")}>{n.label}</span>
                </div>
              ))}
            </div>
            <div style={st("margin:26px 0 5px;height:2px;background:#1A1A1E;")}>
              <div style={st("height:100%;width:" + demo.barPct + "%;background:" + demo.barColor + ";transition:width .1s linear;")}></div>
            </div>
            <div style={st("font-size:12px;color:#86868E;min-height:16px;")}>{demo.status}</div>
          </div>
          <div style={st("display:grid;grid-template-columns:repeat(5,1fr);border-top:1px solid #2A2A30;")}>
            <div style={st("padding:16px 20px;border-right:1px solid #2A2A30;")}>
              <div style={st("font-size:10.5px;color:#56565E;letter-spacing:0.4px;margin-bottom:8px;")}>GPU TEMP</div>
              <div style={st("font-size:19px;font-weight:700;color:" + demo.tempColor + ";")}>{demo.tempLabel}</div>
            </div>
            <div style={st("padding:16px 20px;border-right:1px solid #2A2A30;")}>
              <div style={st("font-size:10.5px;color:#56565E;letter-spacing:0.4px;margin-bottom:8px;")}>VRAM</div>
              <div style={st("font-size:19px;font-weight:700;color:" + demo.vramColor + ";")}>{demo.vramLabel}</div>
            </div>
            <div style={st("padding:16px 20px;border-right:1px solid #2A2A30;")}>
              <div style={st("font-size:10.5px;color:#56565E;letter-spacing:0.4px;margin-bottom:8px;")}>BILLING</div>
              <div style={st("font-size:19px;font-weight:700;color:" + demo.rateColor + ";")}>{demo.rateLabel}</div>
            </div>
            <div style={st("padding:16px 20px;border-right:1px solid #2A2A30;")}>
              <div style={st("font-size:10.5px;color:#56565E;letter-spacing:0.4px;margin-bottom:8px;")}>ACCRUED</div>
              <div style={st("font-size:19px;font-weight:700;color:#FFFFFF;")}>{demo.costLabel}</div>
            </div>
            <div style={st("padding:16px 20px;")}>
              <div style={st("font-size:10.5px;color:#56565E;letter-spacing:0.4px;margin-bottom:8px;")}>STEP</div>
              <div style={st("font-size:19px;font-weight:700;color:" + demo.stepColor + ";")}>{demo.stepLabel}</div>
            </div>
          </div>
        </div>
      </div>

      {/* PROBLEM */}
      <div id="problem" style={st("max-width:1180px;margin:0 auto;padding:104px 32px 0;")}>
        <div style={st("display:grid;grid-template-columns:84px 1fr;")}>
          <div style={st("display:flex;flex-direction:column;gap:16px;padding-top:4px;")}>
            <span style={st("font-size:12px;color:#56565E;")}>01</span>
            <span className="bh-rail">problem</span>
          </div>
          <div style={st("border-left:1px solid #2A2A30;padding-left:40px;")}>
            <h2 style={st("font-size:clamp(26px,3.4vw,40px);font-weight:800;letter-spacing:-1.4px;margin:0 0 36px;color:#FFFFFF;")}>The cold-start tax.</h2>
            {v.problems.map((p, i) => (
              <div key={i} style={st("display:grid;grid-template-columns:30px 1fr;gap:18px;align-items:baseline;padding:20px 0;border-top:1px solid #202026;")}>
                <span style={st("font-size:12px;color:#3A3A42;")}>{p.n}</span>
                <div style={st("font-size:clamp(16px,2vw,20px);line-height:1.4;color:#909098;")}>
                  <span style={st("color:#E6E6E6;font-weight:700;")}>{p.label}</span> — {p.line}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SOLUTION */}
      <div style={st("max-width:1180px;margin:0 auto;padding:96px 32px 0;")}>
        <div style={st("display:grid;grid-template-columns:84px 1fr;")}>
          <div style={st("display:flex;flex-direction:column;gap:16px;padding-top:4px;")}>
            <span style={st("font-size:12px;color:#B5A8FF;")}>02</span>
            <span className="bh-rail" style={st("color:#B5A8FF;")}>bothub</span>
          </div>
          <div style={st("border-left:1px solid #2A2A30;padding-left:40px;")}>
            <h2 style={st("font-size:clamp(26px,3.4vw,40px);font-weight:800;letter-spacing:-1.4px;margin:0 0 36px;color:#FFFFFF;")}>Freeze it. Move it.<br />Bring any brain.</h2>
            {v.solutions.map((s, i) => (
              <div key={i} style={st("display:grid;grid-template-columns:30px 1fr;gap:18px;align-items:baseline;padding:20px 0;border-top:1px solid #202026;")}>
                <span style={st("font-size:12px;color:" + s.numColor + ";")}>{s.n}</span>
                <div style={st("font-size:clamp(16px,2vw,20px);line-height:1.4;color:#B8B8C0;")}>
                  <span style={st("color:" + s.labelColor + ";font-weight:700;")}>{s.label}</span> — {s.line}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ============ TRY / DOCKER-DESKTOP-STYLE APP ============ */}
      <div id="try" style={st("border-top:1px solid #2A2A30;background:#0A0A0C;margin-top:104px;")}>
        <div style={st("max-width:1180px;margin:0 auto;padding:60px 32px 76px;")}>
          <div style={st("display:grid;grid-template-columns:84px 1fr;")}>
            <div style={st("display:flex;flex-direction:column;gap:16px;padding-top:4px;")}>
              <span style={st("font-size:12px;color:#56565E;")}>03</span>
              <span className="bh-rail">try</span>
            </div>
            <div style={st("border-left:1px solid #2A2A30;padding-left:40px;")}>
              <h2 style={st("font-size:clamp(26px,3.4vw,40px);font-weight:800;letter-spacing:-1.4px;margin:0 0 28px;color:#FFFFFF;")}>BotHub Desktop.</h2>

              <Dashboard v={v} />
            </div>
          </div>
        </div>
      </div>

      {/* PRICING */}
      <div id="pricing" style={st("max-width:1180px;margin:0 auto;padding:104px 32px 0;")}>
        <div style={st("display:grid;grid-template-columns:84px 1fr;")}>
          <div style={st("display:flex;flex-direction:column;gap:16px;padding-top:4px;")}>
            <span style={st("font-size:12px;color:#56565E;")}>04</span>
            <span className="bh-rail">pricing</span>
          </div>
          <div style={st("border-left:1px solid #2A2A30;padding-left:40px;")}>
            <h2 style={st("font-size:clamp(26px,3.4vw,40px);font-weight:800;letter-spacing:-1.4px;margin:0 0 36px;color:#FFFFFF;")}>Free to run.</h2>
            <div style={st("display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;align-items:stretch;")}>
              {v.tiers.map((t, i) => (
                <div key={i} style={st("border:1px solid " + t.border + ";background:" + t.cardBg + ";padding:26px 24px;position:relative;")}>
                  {t.recommended && (
                    <div style={st("position:absolute;top:-1px;right:-1px;background:#B5A8FF;color:#0D0D0F;font-size:10px;font-weight:700;letter-spacing:0.5px;padding:4px 10px;")}>RECOMMENDED</div>
                  )}
                  <div style={st("font-size:13px;color:" + t.nameColor + ";font-weight:700;letter-spacing:0.3px;margin-bottom:18px;")}>{t.name}</div>
                  <div style={st("display:flex;align-items:baseline;gap:6px;margin-bottom:22px;")}>
                    <span style={st("font-size:34px;font-weight:800;letter-spacing:-1.5px;color:#FFFFFF;")}>{t.price}</span>
                    <span style={st("font-size:13px;color:#56565E;")}>{t.unit}</span>
                  </div>
                  <Hover as="button" style={st(t.btnStyle)} hover={st(t.btnHover)}>{t.cta}</Hover>
                  <div style={st("margin-top:22px;display:flex;flex-direction:column;gap:11px;")}>
                    {t.features.map((f, j) => (
                      <div key={j} style={st("display:flex;align-items:flex-start;gap:10px;font-size:12.5px;line-height:1.45;color:#B8B8C0;")}>
                        <span style={st("color:" + f.markColor + ";flex:none;")}>{f.mark}</span><span>{f.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* TEAM */}
      <div style={st("max-width:1180px;margin:0 auto;padding:104px 32px 0;")}>
        <div style={st("display:grid;grid-template-columns:84px 1fr;")}>
          <div style={st("display:flex;flex-direction:column;gap:16px;padding-top:4px;")}>
            <span style={st("font-size:12px;color:#56565E;")}>05</span>
            <span className="bh-rail">team</span>
          </div>
          <div style={st("border-left:1px solid #2A2A30;padding-left:40px;")}>
            <h2 style={st("font-size:clamp(26px,3.4vw,40px);font-weight:800;letter-spacing:-1.4px;margin:0 0 36px;color:#FFFFFF;")}>Tired of cold starts.</h2>
            <div style={st("display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;")}>
              <div style={st("border:1px solid #2A2A30;background:#0A0A0C;padding:22px;")}>
                <div style={st("display:flex;align-items:center;gap:14px;margin-bottom:16px;")}>
                  <div>
                    <div style={st("font-size:14px;font-weight:700;color:#FFFFFF;")}>Yudhishthra Sugumaran</div>
                    <div style={st("font-size:11.5px;color:#B5A8FF;margin-top:3px;")}>CTO (Chief Technology Officer)</div>
                  </div>
                </div>
                <div style={st("font-size:12.5px;line-height:1.55;color:#909098;")}>CRIU ↔ cuda-checkpoint. Freezes live VRAM.</div>
              </div>
              <div style={st("border:1px solid #2A2A30;background:#0A0A0C;padding:22px;")}>
                <div style={st("display:flex;align-items:center;gap:14px;margin-bottom:16px;")}>
                  <div>
                    <div style={st("font-size:14px;font-weight:700;color:#FFFFFF;")}>Pedro Rosalba</div>
                    <div style={st("font-size:11.5px;color:#86868E;margin-top:3px;")}>CEO (Chief Executive Officer)</div>
                  </div>
                </div>
                <div style={st("font-size:12.5px;line-height:1.55;color:#909098;")}>Spot orchestration. $4/hr → $0.50.</div>
              </div>
              <div style={st("border:1px solid #2A2A30;background:#0A0A0C;padding:22px;")}>
                <div style={st("display:flex;align-items:center;gap:14px;margin-bottom:16px;")}>
                  <div>
                    <div style={st("font-size:14px;font-weight:700;color:#FFFFFF;")}>Tomas Mazzitello</div>
                    <div style={st("font-size:11.5px;color:#86868E;margin-top:3px;")}>CTO (Chief Taste Officer)</div>
                  </div>
                </div>
                <div style={st("font-size:12.5px;line-height:1.55;color:#909098;")}>CLI, MCP, the open spec.</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div style={st("border-top:1px solid #2A2A30;margin-top:104px;")}>
        <div style={st("max-width:1180px;margin:0 auto;padding:44px 32px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:20px;")}>
          <div style={st("display:flex;flex-direction:column;gap:12px;")}>
            <span style={st("display:inline-flex;align-items:center;font-weight:800;font-size:22px;letter-spacing:-1.2px;")}>
              <span style={st("color:#FFFFFF;")}>Bot</span>
              <span style={st("background:#B5A8FF;color:#0D0D0F;padding:1px 8px 2px;border-radius:5px;margin-left:2px;")}>Hub</span>
            </span>
            <span style={st("font-size:11.5px;color:#3A3A42;")}>© 2026 · open-source · MIT · the sandbox is yours</span>
          </div>
          <div style={st("display:flex;gap:24px;font-size:12.5px;color:#86868E;flex-wrap:wrap;")}>
            <Hover as="a" href="#" style={st("color:#86868E;text-decoration:none;")} hover={st("color:#B5A8FF;")}>Docs</Hover>
            <Hover as="a" href="#" style={st("color:#86868E;text-decoration:none;")} hover={st("color:#B5A8FF;")}>GitHub</Hover>
            <Hover as="a" href="#" style={st("color:#86868E;text-decoration:none;")} hover={st("color:#B5A8FF;")}>CLI</Hover>
            <Hover as="a" href="#" style={st("color:#86868E;text-decoration:none;")} hover={st("color:#B5A8FF;")}>X</Hover>
            <Hover as="a" href="#" style={st("color:#86868E;text-decoration:none;")} hover={st("color:#B5A8FF;")}>Discord</Hover>
          </div>
        </div>
      </div>
    </div>
  );
}
