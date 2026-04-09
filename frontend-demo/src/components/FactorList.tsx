import { motion } from 'framer-motion';

interface FactorListProps {
  factors: string[];
}

const FactorList = ({ factors }: FactorListProps) => {
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.3
      }
    }
  };

  const item = {
    hidden: { opacity: 0, x: -20 },
    show: { opacity: 1, x: 0, transition: { duration: 0.5 } }
  };

  return (
    <motion.ul
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-2"
    >
      {factors.map((factor, index) => (
        <motion.li
          key={index}
          variants={item}
          className="flex items-start gap-2 text-sm text-secondary"
        >
          <span className="text-primary mt-1">•</span>
          <span>{factor}</span>
        </motion.li>
      ))}
    </motion.ul>
  );
};

export default FactorList;
