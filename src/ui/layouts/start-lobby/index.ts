import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { AspectCategory } from '../use-aspect-category';
import type { StartLobbyLayoutProps } from './types';

const TallLayout = lazy(() => import('./layout-tall'));
const StandardLayout = lazy(() => import('./layout-standard'));
const WideLayout = lazy(() => import('./layout-wide'));

const layoutMap: Record<AspectCategory, LazyExoticComponent<ComponentType<StartLobbyLayoutProps>>> = {
  tall: TallLayout,
  standard: StandardLayout,
  wide: WideLayout
};

export function getStartLobbyLayout(category: AspectCategory): LazyExoticComponent<ComponentType<StartLobbyLayoutProps>> {
  return layoutMap[category] ?? StandardLayout;
}

export type { StartLobbyLayoutProps };
