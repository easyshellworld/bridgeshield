import { motion } from 'framer-motion';

interface RiskScoreMeterProps {
  score: number;
  size?: number;
  strokeWidth?: number;
}

const RiskScoreMeter = ({ score, size = 280, strokeWidth = 24 }: RiskScoreMeterProps) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(100, Math.max(0, score)) / 100;
  const strokeDashoffset = circumference * (1 - progress);

  const getColor = () => {
    if (score < 33) return '#00D4AA';
    if (score < 67) return '#FFB020';
    return '#FF3B3B';
  };

  const getGlow = () => {
    if (score < 33) return 'shadow-glow';
    if (score < 67) return 'shadow-glow-warning';
    return 'shadow-glow-danger';
  };

  return (
    <div className="relative flex items-center justify-center">
      <svg width={size} height={size} className={`${getGlow()} rounded-full`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={getColor()}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          strokeLinecap="round"
          transform={`rotate(-90 ${size/2} ${size/2})`}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center">
        <motion.span
          className="font-mono text-6xl font-bold"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          style={{ color: getColor() }}
        >
          {Math.round(score)}
        </motion.span>
        <span className="text-secondary text-sm font-medium">RISK SCORE</span>
      </div>
    </div>
  );
};

export default RiskScoreMeter;
