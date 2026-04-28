'use client';

import { useEffect } from 'react';
import { applyMaterialTheme, generateMaterialTheme } from '@/lib/theme';

const THEME_SEED = '#F08A84';

export default function ThemeProvider({ children }) {
  useEffect(() => {
    const { light } = generateMaterialTheme(THEME_SEED);

    applyMaterialTheme(light);
    document.documentElement.style.colorScheme = 'light';
  }, []);

  return children;
}
