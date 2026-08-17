(function() {
    const VALID_VIEWS = ['learn', 'explore'];
    const FALLBACK_ALL_POINTS_FILTER = ['==', ['literal', true], true];

    function cloneFilter(filter) {
        if (filter == null) return filter;

        if (typeof structuredClone === 'function') {
            return structuredClone(filter);
        }

        return JSON.parse(JSON.stringify(filter));
    }

    function allPointsFilter() {
        return cloneFilter(
            typeof ALL_POINTS_FILTER !== 'undefined'
                ? ALL_POINTS_FILTER
                : FALLBACK_ALL_POINTS_FILTER
        );
    }

    function viewFromTab(tab) {
        const dataView = tab?.dataset.viewTab || tab?.dataset.view;
        if (VALID_VIEWS.includes(dataView)) return dataView;
        if (tab?.id === 'learn-tab') return 'learn';
        if (tab?.id === 'explore-tab') return 'explore';
        return null;
    }

    function findTabs() {
        const candidates = document.querySelectorAll(
            '[data-view-tab], #learn-tab, #explore-tab'
        );

        return Array.from(candidates).filter(tab => viewFromTab(tab));
    }

    function viewPanels(view) {
        const panels = document.querySelectorAll(
            `[data-view-panel="${view}"], #${view}-view`
        );

        return Array.from(new Set(panels));
    }

    function captureMapState(map) {
        // stop animations before camera values are split across frames
        if (typeof map.stop === 'function') map.stop();

        const center = map.getCenter();
        return {
            center: [center.lng, center.lat],
            zoom: map.getZoom(),
            bearing: map.getBearing(),
            pitch: map.getPitch(),
            activePointFilter: cloneFilter(map._activePointFilter),
            selectedFeatureId: map._selectedFeatureId ?? null,
            satelliteEnabled: window._nhlSatelliteControl?.isEnabled()
        };
    }

    function applyPointState(map, filter, selectedFeatureId) {
        map._selectedFeatureId = selectedFeatureId;

        if (filter === undefined) {
            delete map._activePointFilter;
        } else {
            const nextFilter = cloneFilter(filter);
            if (typeof setActivePointFilters === 'function') {
                setActivePointFilters(map, nextFilter);
            } else {
                map._activePointFilter = nextFilter;
            }
        }

        if (typeof setSelectedPointFilters === 'function') {
            setSelectedPointFilters(map);
        }
    }

    function restoreMapState(map, snapshot, view) {
        const activePointFilter = view === 'learn' && snapshot.activePointFilter === undefined
            ? allPointsFilter()
            : snapshot.activePointFilter;

        applyPointState(
            map,
            activePointFilter,
            snapshot.selectedFeatureId
        );

        // jumpTo keeps the per-view camera exact without a cross-view animation
        map.jumpTo({
            center: snapshot.center,
            zoom: snapshot.zoom,
            bearing: snapshot.bearing,
            pitch: snapshot.pitch
        });

        if (typeof snapshot.satelliteEnabled === 'boolean') {
            window._nhlSatelliteControl?.setEnabled(snapshot.satelliteEnabled);
        }
    }

    function setupViewSwitcher() {
        if (window._nhlViewSwitcher) {
            return window._nhlViewSwitcher;
        }

        const main = document.querySelector('main');
        const tabs = findTabs();
        const requestedDefault = main?.dataset.activeView;
        let activeView = VALID_VIEWS.includes(requestedDefault)
            ? requestedDefault
            : 'learn';
        const snapshots = { learn: null, explore: null };
        const initializedMaps = new WeakMap();

        function mapInstance() {
            return window._nhlMapInstance || null;
        }

        function initializedViewsFor(map) {
            let initializedViews = initializedMaps.get(map);
            if (!initializedViews) {
                initializedViews = new Set();
                initializedMaps.set(map, initializedViews);
            }
            return initializedViews;
        }

        function syncDom(view) {
            if (main) main.dataset.activeView = view;

            tabs.forEach(tab => {
                const selected = viewFromTab(tab) === view;
                tab.setAttribute('aria-selected', String(selected));
                tab.tabIndex = selected ? 0 : -1;
                tab.classList.toggle('is-active', selected);
            });

            VALID_VIEWS.forEach(panelView => {
                const hidden = panelView !== view;
                viewPanels(panelView).forEach(panel => {
                    panel.hidden = hidden;
                    panel.setAttribute('aria-hidden', String(hidden));
                });
            });
        }

        function initializeMapView(map, view) {
            if (view === 'learn') {
                // learn starts unfiltered until spotlight data is available
                applyPointState(map, allPointsFilter(), null);
            }
        }

        function syncMapState(map = mapInstance()) {
            if (!map) return false;

            const initializedViews = initializedViewsFor(map);
            if (!initializedViews.has(activeView)) {
                if (snapshots[activeView]) {
                    restoreMapState(map, snapshots[activeView], activeView);
                } else {
                    initializeMapView(map, activeView);
                }
                initializedViews.add(activeView);
            }

            if (typeof map.resize === 'function') map.resize();
            return true;
        }

        function setView(view, options = {}) {
            if (!VALID_VIEWS.includes(view)) {
                throw new TypeError(`Unknown NHL view: ${view}`);
            }

            const previousView = activeView;
            const map = mapInstance();
            const activeElement = document.activeElement;
            const focusWillBeHidden = previousView !== view
                && (
                    viewPanels(previousView).some(panel => panel.contains(activeElement))
                    || (previousView === 'explore' && activeElement?.closest?.('[data-ported="true"]'))
                );

            if (previousView !== view && map) {
                snapshots[previousView] = captureMapState(map);
                initializedViewsFor(map).add(previousView);
            }

            activeView = view;
            syncDom(view);

            if (previousView !== view && map) {
                const initializedViews = initializedViewsFor(map);
                if (snapshots[view]) {
                    restoreMapState(map, snapshots[view], view);
                } else {
                    // first explore visit intentionally inherits current map state
                    initializeMapView(map, view);
                }
                initializedViews.add(view);
                if (typeof map.resize === 'function') map.resize();
            } else if (options.syncMap !== false) {
                syncMapState(map);
            }

            const activeTab = tabs.find(tab => viewFromTab(tab) === view);
            if ((options.focus || focusWillBeHidden) && activeTab !== activeElement) {
                activeTab?.focus();
            }

            if (previousView !== view && options.dispatch !== false) {
                window.dispatchEvent(new CustomEvent('nhl:viewchange', {
                    detail: { previousView, view }
                }));
            }

            return activeView;
        }

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                setView(viewFromTab(tab));
            });

            tab.addEventListener('keydown', event => {
                const currentIndex = tabs.indexOf(tab);
                let nextIndex = null;

                if (event.key === 'ArrowRight') {
                    nextIndex = (currentIndex + 1) % tabs.length;
                } else if (event.key === 'ArrowLeft') {
                    nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
                } else if (event.key === 'Home') {
                    nextIndex = 0;
                } else if (event.key === 'End') {
                    nextIndex = tabs.length - 1;
                }

                if (nextIndex == null) return;
                event.preventDefault();
                setView(viewFromTab(tabs[nextIndex]), { focus: true });
            });
        });

        const controller = {
            getView: () => activeView,
            setView,
            syncMapState
        };

        window._nhlViewSwitcher = controller;
        syncDom(activeView);
        syncMapState();

        return controller;
    }

    window.setupViewSwitcher = setupViewSwitcher;
})();
