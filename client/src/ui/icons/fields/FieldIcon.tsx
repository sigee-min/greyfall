import React from 'react';

type Props = {
  kind: string;
  r?: number; // radius/half-size in world units
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
};

export function FieldIcon({ kind, r = 5, fill = '#0f172a', stroke = '#a3e1ff', strokeWidth = 1 }: Props) {
  const s = Math.max(1, r);
  const sw = Math.max(0.5, strokeWidth);
  switch (kind) {
    case 'entry':
      return (
        <g>
          <polygon
            points={`${-s},0 ${-s/2},${-s} ${s/2},${-s} ${s},0 ${s/2},${s} ${-s/2},${s}`}
            fill={fill}
            stroke={stroke}
            strokeWidth={sw}
            vectorEffect="non-scaling-stroke"
          />
        </g>
      );
    case 'market':
      return (
        <rect x={-s} y={-s} width={2*s} height={2*s} rx={s*0.2} fill={fill} stroke={stroke} strokeWidth={sw} vectorEffect="non-scaling-stroke" />
      );
    case 'interior':
      return (
        <g>
          <path d={`M ${-s} ${s} L ${-s} ${0} Q 0 ${-s} ${s} ${0} L ${s} ${s} Z`} fill={fill} stroke={stroke} strokeWidth={sw} vectorEffect="non-scaling-stroke" />
        </g>
      );
    case 'docks':
      return (
        <g>
          <circle r={s*0.9} fill={fill} stroke={stroke} strokeWidth={sw} vectorEffect="non-scaling-stroke" />
          <path d={`M 0 ${-s*0.9} L 0 ${s*0.6}`} stroke={stroke} strokeWidth={sw} vectorEffect="non-scaling-stroke" />
          <path d={`M ${-s*0.6} ${s*0.2} Q 0 ${s*0.9} ${s*0.6} ${s*0.2}`} stroke={stroke} strokeWidth={sw} fill="none" vectorEffect="non-scaling-stroke" />
        </g>
      );
    case 'junction':
      return (
        <polygon points={`0,${-s} ${s},${s} ${-s},${s}`} fill={fill} stroke={stroke} strokeWidth={sw} vectorEffect="non-scaling-stroke" />
      );
    case 'vault':
      return (
        <g>
          <rect x={-s} y={-s*0.7} width={2*s} height={1.4*s} rx={s*0.2} fill={fill} stroke={stroke} strokeWidth={sw} vectorEffect="non-scaling-stroke" />
          <circle cx={0} cy={0} r={s*0.25} fill={stroke} />
        </g>
      );
    case 'district':
    default:
      return <circle r={s} fill={fill} stroke={stroke} strokeWidth={sw} vectorEffect="non-scaling-stroke" />;
  }
}

