import { lazy, type LazyExoticComponent, type ComponentType } from 'react';
import type { AspectCategory } from '../use-aspect-category';
import type { LobbyLayoutProps } from './types';

const TallLayout = lazy(() => import('./layout-tall'));
const StandardLayout = lazy(() => import('./layout-standard'));
const WideLayout = lazy(() => import('./layout-wide'));

const defaultLayout: LazyExoticComponent<ComponentType<LobbyLayoutProps>> = StandardLayout;

const layoutByCategory: Record<AspectCategory, LazyExoticComponent<ComponentType<LobbyLayoutProps>>> = {
  tall: TallLayout,
  standard: StandardLayout,
  wide: WideLayout
};

export function getLobbyLayout(category: AspectCategory): LazyExoticComponent<ComponentType<LobbyLayoutProps>> {
  return layoutByCategory[category] ?? defaultLayout;
}

export type { LobbyLayoutProps };
