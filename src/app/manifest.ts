import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'SignalForge · 个人量化研究台',
    short_name: 'SignalForge',
    description: '把市场假设拆成数据、指标和回测，沉淀可复核的个人量化研究记录。',
    start_url: '/',
    display: 'standalone',
    background_color: '#f8fafc',
    theme_color: '#167a6a',
    icons: [
      {
        src: '/icons/quantpilot-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/quantpilot-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
