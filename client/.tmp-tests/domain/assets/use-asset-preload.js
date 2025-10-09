import { useEffect, useRef } from 'react';
import { shallow } from 'zustand/shallow';
import { AssetPreloadManager } from '../../assets/preload-manager';
import { preloadManifest, listAllPreloadEntries } from '../../assets/preload-manifest';
import { useAssetPreloadStore } from './preload-store';
import { selectAssetPreloadEnabled, selectPreferencesLoaded, usePreferencesStore, } from '../../store/preferences';
function suggestConcurrency() {
    if (typeof navigator === 'undefined')
        return 2;
    const anyNav = navigator;
    const connection = anyNav.connection;
    if (!connection)
        return 2;
    if (connection.saveData)
        return 1;
    if (typeof connection.downlink === 'number' && connection.downlink < 1.5)
        return 1;
    if (connection.effectiveType && /3g|2g|slow-2g/.test(connection.effectiveType))
        return 1;
    return 2;
}
export function useAssetPreload() {
    const preferencesLoaded = usePreferencesStore(selectPreferencesLoaded);
    const preloadEnabled = usePreferencesStore(selectAssetPreloadEnabled);
    const { manager, attachManager, handleEvent, initialiseSnapshot, clearSnapshot } = useAssetPreloadStore((state) => ({
        manager: state.manager,
        attachManager: state.attachManager,
        handleEvent: state.handleEvent,
        initialiseSnapshot: state.initialiseSnapshot,
        clearSnapshot: state.clearSnapshot,
    }), shallow);
    const managerRef = useRef(null);
    // Mount/unmount lifecycle
    useEffect(() => {
        if (!preferencesLoaded)
            return;
        if (!preloadEnabled) {
            if (managerRef.current) {
                managerRef.current.cancel();
                managerRef.current = null;
            }
            attachManager(null);
            clearSnapshot();
            return;
        }
        if (managerRef.current)
            return;
        const entries = listAllPreloadEntries();
        initialiseSnapshot(entries.length);
        const concurrency = suggestConcurrency();
        const preloadManager = new AssetPreloadManager(preloadManifest, { concurrency, entries });
        managerRef.current = preloadManager;
        attachManager(preloadManager);
        const unsubscribe = preloadManager.on(handleEvent);
        preloadManager.start();
        return () => {
            unsubscribe();
            preloadManager.cancel();
            attachManager(null);
            managerRef.current = null;
            clearSnapshot();
        };
    }, [preferencesLoaded, preloadEnabled, attachManager, handleEvent, initialiseSnapshot, clearSnapshot]);
    // Pause/resume on visibility change
    useEffect(() => {
        const activeManager = managerRef.current ?? manager;
        if (!activeManager)
            return;
        if (typeof document === 'undefined')
            return;
        const onVisibility = () => {
            if (document.visibilityState === 'hidden') {
                activeManager.pause();
            }
            else if (document.visibilityState === 'visible' && preloadEnabled) {
                const status = activeManager.getStatus();
                if (status === 'paused') {
                    activeManager.resume();
                }
                else if (status === 'idle') {
                    activeManager.start();
                }
            }
        };
        document.addEventListener('visibilitychange', onVisibility);
        onVisibility();
        return () => {
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }, [manager, preloadEnabled]);
}
