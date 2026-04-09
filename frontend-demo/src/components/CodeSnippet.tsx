import { useState } from 'react';
import { motion } from 'framer-motion';

interface CodeSnippetProps {
  code: string;
  language?: string;
}

const CodeSnippet = ({ code, language = 'typescript' }: CodeSnippetProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-2">
        <span className="text-secondary text-sm font-mono">{language}</span>
        <motion.button
          onClick={handleCopy}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="text-xs px-3 py-1 bg-card border border-white/10 rounded-lg hover:bg-white/10 transition-all"
        >
          {copied ? 'COPIED!' : 'COPY CODE'}
        </motion.button>
      </div>
      <div className="bg-black/40 p-6 rounded-lg border border-white/10 font-mono text-sm overflow-x-auto">
        <pre className="text-secondary whitespace-pre-wrap">{code}</pre>
      </div>
    </div>
  );
};

export default CodeSnippet;
