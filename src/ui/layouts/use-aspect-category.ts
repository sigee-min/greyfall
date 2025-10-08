import { useEffect, useState } from 'react';

export type AspectCategory = 'tall' | 'standard' | 'wide';

function categorizeAspect(width: number, height: number): AspectCategory {
  const ratio = width / Math.max(height, 1);
  if (!Number.isFinite(ratio) || ratio <= 0) return 'standard';

  // Portrait or square-ish -> tall layout with stacked content
  if (height >= width || ratio <= 1.25 || width < 960) return 'tall';

  // Ultra wide monitors or very large canvases -> wide layout
  if ((width >= 1600 && ratio >= 1.75) || ratio >= 2.05) return 'wide';

  return 'standard';
}

export function useAspectCategory(): AspectCategory {
  const [category, setCategory] = useState<AspectCategory>(() => {
    if (typeof window === 'undefined') return 'standard';
    return categorizeAspect(window.innerWidth, window.innerHeight);
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const update = () => {
      setCategory(categorizeAspect(window.innerWidth, window.innerHeight));
    };

    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return category;
}
