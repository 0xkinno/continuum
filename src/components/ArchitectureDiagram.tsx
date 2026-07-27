import React from 'react'

export default function ArchitectureDiagram({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1200 600"
      className={className}
      style={{
        width: '100%',
        height: 'auto',
        background: '#F6F4EF',
        borderRadius: '16px',
        border: '1px solid #E2DCD0',
        boxShadow: '0 4px 20px rgba(23, 22, 26, 0.05)',
      }}
    >
      <defs>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&display=swap');
          .excali-title { font-family: 'IBM Plex Mono', monospace; font-size: 15px; font-weight: 600; fill: #17161A; }
          .excali-sub   { font-family: 'IBM Plex Mono', monospace; font-size: 12px; font-weight: 400; fill: #5C5852; }
          .excali-label { font-family: 'IBM Plex Mono', monospace; font-size: 12px; font-weight: 500; fill: #D4A843; }
          .excali-head  { font-family: 'IBM Plex Mono', monospace; font-size: 18px; font-weight: 600; fill: #17161A; }
        `}</style>

        {/* Hand-drawn style arrowhead marker */}
        <marker
          id="hand-arrow"
          viewBox="0 0 10 10"
          refX="6"
          refY="5"
          markerWidth="8"
          markerHeight="8"
          orient="auto-start-reverse"
        >
          <path d="M 1 2 L 8 5 L 1 8 C 2.5 5 2.5 5 1 2 Z" fill="#D4A843" stroke="#D4A843" strokeWidth="1" strokeLinejoin="round" />
        </marker>

        {/* Secondary arrowhead marker */}
        <marker
          id="hand-arrow-ink"
          viewBox="0 0 10 10"
          refX="6"
          refY="5"
          markerWidth="8"
          markerHeight="8"
          orient="auto-start-reverse"
        >
          <path d="M 1 2 L 8 5 L 1 8 C 2.5 5 2.5 5 1 2 Z" fill="#17161A" stroke="#17161A" strokeWidth="1" strokeLinejoin="round" />
        </marker>
      </defs>

      {/* Header Label */}
      <text x="50" y="45" className="excali-head">Continuum — Four-Agent Sequential Pipeline</text>
      <text x="1000" y="45" className="excali-label">watsonx.ai · Granite 3-8B</text>

      {/* ── ROW 1: INGESTION PIPELINE ────────────────────────────────────────── */}

      {/* Node 1: Upload Files */}
      <g transform="translate(40, 90)">
        <path
          d="M 12 4 C 60 2, 130 5, 178 3 C 187 18, 185 62, 188 76 C 130 78, 60 75, 10 77 C 8 60, 11 20, 12 4 Z"
          fill="#FFFFFF"
          stroke="#17161A"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <text x="25" y="34" className="excali-title">Upload Sources</text>
        <text x="25" y="54" className="excali-sub">.txt .md .pdf .docx</text>
      </g>

      {/* Arrow 1 -> 2 */}
      <path
        d="M 230 130 C 255 128, 265 132, 288 130"
        fill="none"
        stroke="#D4A843"
        strokeWidth="2.8"
        strokeLinecap="round"
        markerEnd="url(#hand-arrow)"
      />
      <text x="238" y="118" className="excali-label">raw file</text>

      {/* Node 2: Docling Parser */}
      <g transform="translate(295, 90)">
        <path
          d="M 8 5 C 65 3, 140 6, 192 4 C 196 22, 194 58, 195 76 C 135 78, 65 74, 6 76 C 4 58, 7 22, 8 5 Z"
          fill="#FFFFFF"
          stroke="#17161A"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <text x="25" y="34" className="excali-title">Docling Parser</text>
        <text x="25" y="54" className="excali-sub">Python Subprocess</text>
      </g>

      {/* Arrow 2 -> 3 */}
      <path
        d="M 492 130 C 515 132, 528 128, 552 130"
        fill="none"
        stroke="#D4A843"
        strokeWidth="2.8"
        strokeLinecap="round"
        markerEnd="url(#hand-arrow)"
      />
      <text x="496" y="118" className="excali-label">Markdown</text>

      {/* Node 3: Ingestion Agent */}
      <g transform="translate(560, 90)">
        <path
          d="M 10 4 C 75 2, 155 5, 218 3 C 223 20, 220 60, 222 77 C 150 79, 70 75, 8 77 C 6 56, 9 20, 10 4 Z"
          fill="#FFFFFF"
          stroke="#17161A"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <text x="24" y="34" className="excali-title">Ingestion Agent</text>
        <text x="24" y="54" className="excali-sub">IBM Granite Extract</text>
      </g>

      {/* Arrow 3 -> 4 */}
      <path
        d="M 784 130 C 808 128, 822 132, 848 130"
        fill="none"
        stroke="#D4A843"
        strokeWidth="2.8"
        strokeLinecap="round"
        markerEnd="url(#hand-arrow)"
      />
      <text x="792" y="118" className="excali-label">FactModel</text>

      {/* Node 4: Knowledge Agent (Database) */}
      <g transform="translate(855, 85)">
        <path
          d="M 12 6 C 85 3, 175 5, 248 4 C 254 25, 252 68, 253 88 C 175 90, 85 86, 10 88 C 7 66, 10 24, 12 6 Z"
          fill="#FFFDF7"
          stroke="#17161A"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <text x="24" y="36" className="excali-title">Knowledge Agent</text>
        <text x="24" y="58" className="excali-sub">SQLite · 12 Tables</text>
      </g>

      {/* ── VERTICAL FEEDBACK / STORE CONNECTORS ───────────────────────────── */}
      {/* Knowledge -> Continuity Reasoning */}
      <path
        d="M 980 178 C 980 270, 720 280, 520 285 C 480 286, 480 340, 480 375"
        fill="none"
        stroke="#17161A"
        strokeWidth="2"
        strokeDasharray="6 4"
        strokeLinecap="round"
        markerEnd="url(#hand-arrow-ink)"
      />
      <text x="680" y="272" className="excali-sub">query stored facts</text>

      {/* ── ROW 2: CONTINUITY CHECKING PIPELINE ───────────────────────────────── */}

      {/* Node 5: New Draft Submitted */}
      <g transform="translate(40, 380)">
        <path
          d="M 10 5 C 65 3, 135 6, 188 4 C 193 22, 191 60, 192 78 C 130 80, 60 76, 8 78 C 6 58, 9 20, 10 5 Z"
          fill="#FFFFFF"
          stroke="#17161A"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <text x="22" y="34" className="excali-title">New Draft</text>
        <text x="22" y="54" className="excali-sub">Unchecked Scene</text>
      </g>

      {/* Arrow 5 -> 6 */}
      <path
        d="M 234 420 C 260 418, 275 422, 302 420"
        fill="none"
        stroke="#D4A843"
        strokeWidth="2.8"
        strokeLinecap="round"
        markerEnd="url(#hand-arrow)"
      />
      <text x="242" y="408" className="excali-label">draft text</text>

      {/* Node 6: Continuity Agent */}
      <g transform="translate(310, 380)">
        <path
          d="M 12 4 C 80 2, 165 5, 238 3 C 244 22, 241 62, 243 80 C 165 82, 80 78, 9 80 C 7 60, 10 20, 12 4 Z"
          fill="#FFFFFF"
          stroke="#17161A"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <text x="24" y="34" className="excali-title">Continuity Agent</text>
        <text x="24" y="54" className="excali-sub">Granite 2-Pass Check</text>
      </g>

      {/* Arrow 6 -> 7 */}
      <path
        d="M 555 420 C 580 418, 595 422, 622 420"
        fill="none"
        stroke="#D4A843"
        strokeWidth="2.8"
        strokeLinecap="round"
        markerEnd="url(#hand-arrow)"
      />
      <text x="562" y="408" className="excali-label">raw flags</text>

      {/* Node 7: Explanation Agent */}
      <g transform="translate(630, 380)">
        <path
          d="M 10 4 C 75 2, 155 5, 228 3 C 234 22, 231 62, 233 80 C 155 82, 75 78, 8 80 C 6 60, 9 20, 10 4 Z"
          fill="#FFFFFF"
          stroke="#17161A"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <text x="24" y="34" className="excali-title">Explanation Agent</text>
        <text x="24" y="54" className="excali-sub">Editorial Notes</text>
      </g>

      {/* Arrow 7 -> 8 */}
      <path
        d="M 865 420 C 890 418, 905 422, 932 420"
        fill="none"
        stroke="#D4A843"
        strokeWidth="2.8"
        strokeLinecap="round"
        markerEnd="url(#hand-arrow)"
      />
      <text x="870" y="408" className="excali-label">annotations</text>

      {/* Node 8: Manuscript Editor */}
      <g transform="translate(940, 380)">
        <path
          d="M 12 4 C 75 2, 155 5, 218 3 C 224 22, 221 62, 223 80 C 150 82, 70 78, 9 80 C 7 60, 10 20, 12 4 Z"
          fill="#FFFDF7"
          stroke="#D4A843"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <text x="22" y="34" className="excali-title">Manuscript View</text>
        <text x="22" y="54" className="excali-sub">Inline Margin Notes</text>
      </g>

      {/* Subtle Legend / Note */}
      <g transform="translate(40, 520)">
        <circle cx="10" cy="10" r="5" fill="#D4A843" />
        <text x="25" y="14" className="excali-sub">Sequential agent flow (JSON context bridge)</text>

        <circle cx="340" cy="10" r="5" fill="#17161A" />
        <text x="355" y="14" className="excali-sub">Structured facts query (SQLite 12-table relational store)</text>
      </g>
    </svg>
  )
}
