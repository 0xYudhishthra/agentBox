"use client";

import Link from "next/link";

import Dashboard from "@/components/Dashboard";
import Hover from "@/components/Hover";
import { st } from "@/lib/style";
import { useBotHub } from "@/lib/useBotHub";

export default function DashboardPage() {
  const v = useBotHub();

  return (
    <div style={st("min-height:100vh;background:#0D0D0F;overflow-x:hidden;")}>
      {/* minimal top bar */}
      <div style={st("position:sticky;top:0;z-index:50;backdrop-filter:blur(10px);background:rgba(13,13,15,0.82);border-bottom:1px solid #2A2A30;")}>
        <div style={st("max-width:1080px;margin:0 auto;padding:0 32px;height:58px;display:flex;align-items:center;justify-content:space-between;")}>
          <Link href="/" style={st("display:inline-flex;align-items:center;font-weight:800;font-size:19px;letter-spacing:-1px;text-decoration:none;")}>
            <span style={st("color:#FFFFFF;")}>Bot</span>
            <span style={st("background:#B5A8FF;color:#0D0D0F;padding:1px 7px 2px;border-radius:4px;margin-left:2px;")}>Hub</span>
          </Link>
          <Hover as={Link} href="/" style={st("font-size:13px;color:#86868E;text-decoration:none;")} hover={st("color:#E6E6E6;")}>← back to site</Hover>
        </div>
      </div>

      {/* dashboard only */}
      <div style={st("max-width:1080px;margin:0 auto;padding:40px 32px 76px;")}>
        <Dashboard v={v} />
      </div>
    </div>
  );
}
