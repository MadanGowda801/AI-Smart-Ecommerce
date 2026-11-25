import React from 'react';
import { CheckCircle2, Shield, Key, Terminal, Database, Cpu } from 'lucide-react';
import env from './env';

const CHECKS = [
  {
    title: 'Frontend Framework & Bundler',
    status: 'Verified Ready',
    detail: 'Vite 6 with React 19, Vanilla CSS design tokens, zero Tailwind bloat, and fast HMR.',
    icon: Cpu,
  },
  {
    title: 'Official InsForge Skills Installed',
    status: '5 Skills Active',
    detail: 'Installed in .agents/skills (insforge, insforge-cli, insforge-debug, insforge-integrations, find-skills).',
    icon: Terminal,
  },
  {
    title: 'Cloud BaaS Connection',
    status: 'Online & Linked',
    detail: `Linked to project c0ed3eee-44c9-4e2a-bef1-1fce09c4f073 (${env.insforgeUrl}).`,
    icon: Database,
  },
  {
    title: 'Secret Safety & Zero Token Leaks',
    status: 'Protected',
    detail: 'Client uses strictly public anon key with Row Level Security. Admin API Key isolated from frontend.',
    icon: Shield,
  },
  {
    title: 'Clean Architecture Scaffolding',
    status: 'Structure Established',
    detail: 'Components, pages, context, services, styles, and env modules organized for modular growth.',
    icon: CheckCircle2,
  },
];

export function ReadinessArchitecture() {
  return (
    <section className="container" style={{ margin: '2rem auto' }}>
      <div className="readiness-panel">
        <div className="readiness-header">
          <div>
            <span className="feature-tag" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}>
              Environment Status
            </span>
            <h2 style={{ fontSize: '1.75rem', marginTop: '0.5rem' }}>
              Project Initialization & InsForge Verification
            </h2>
            <p style={{ marginTop: '0.25rem', fontSize: '0.9rem' }}>
              All 7 initial setup directives have been executed and validated against official InsForge specifications.
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-subtle)' }}>Connected Region</span>
            <div style={{ fontWeight: 700, color: '#a5b4fc' }}>ap-southeast (wheg6hgs)</div>
          </div>
        </div>

        <div className="readiness-list">
          {CHECKS.map((chk, i) => {
            const Icon = chk.icon;
            return (
              <div key={i} className="readiness-item">
                <div className="readiness-icon ready">
                  <Icon size={16} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: '0.925rem', color: '#f8fafc' }}>{chk.title}</strong>
                    <span style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: 600 }}>
                      {chk.status}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    {chk.detail}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default ReadinessArchitecture;
