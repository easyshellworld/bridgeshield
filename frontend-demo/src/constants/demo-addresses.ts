export const DEMO_ADDRESSES = [
  {
    label: 'Ronin Hacker',
    address: '0x098B716B8Aaf21512996dC57EB0615e2383E2f96',
    description: 'Ronin Bridge 2022 · $625M',
    expectedResult: 'BLOCK' as const,
    badge: 'HACKER' as const,
  },
  {
    label: 'Tornado Cash',
    address: '0xd90e2f925DA726b50C4Ed8D0Fb90Ad053324F31b',
    description: 'Tornado Cash Contract · Mixer',
    expectedResult: 'BLOCK' as const,
    badge: 'MIXER' as const,
  },
  {
    label: 'Lido stETH',
    address: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84',
    description: 'Lido Protocol · Known Safe',
    expectedResult: 'ALLOW' as const,
    badge: 'SAFE' as const,
  },
  {
    label: 'Uniswap V3',
    address: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
    description: 'Uniswap V3 Factory · Whitelisted',
    expectedResult: 'ALLOW' as const,
    badge: 'WHITELIST' as const,
  },
];
