import { useEffect, useState } from 'react';

export type AspectCategory = 'tall' | 'standard' | 'wide';

function categorizeAspect(ratio: number): AspectCategory {
  if (!Number.isFinite(ratio) || ratio <= 0) return 'standard';
  if (ratio < 1.3) return 'tall'; // 4:3, 5:4 등 세로에 가까운 화면
  if (ratio > 1.9) return 'wide'; // 18:9 이상, 21:9 등 초광폭
  return 'standard'; // 3:2 ~ 16:9 일반 비율
}

export function useAspectCategory(): AspectCategory {
  const [category, setCategory] = useState<AspectCategory>(() => {
    if (typeof window === 'undefined') return 'standard';
    return categorizeAspect(window.innerWidth / window.innerHeight);
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const update = () => {
      setCategory(categorizeAspect(window.innerWidth / window.innerHeight));
    };

    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return category;
}
