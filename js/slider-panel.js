// keep both year filters aligned with the current data range
const YEAR_SLIDER_MAX = 2026;

// each field keeps its data property and matching markup in one place
const YEAR_FIELD_OPTIONS = {
    formYear: {
        key: 'formYear',
        label: 'Form year',
        property: 'Form Year',
        min: 1950,
        max: YEAR_SLIDER_MAX,
        excludeMultiple: true,
        elementIds: ['form-year-slider', 'year-slider'],
        resetIds: ['form-year-reset', 'year-reset'],
        modeIds: ['form-year-mode']
    },
    nhlYear: {
        key: 'nhlYear',
        label: 'Year designated',
        property: 'NHL_Year',
        min: 1937,
        max: YEAR_SLIDER_MAX,
        excludeMultiple: false,
        elementIds: ['designation-year-slider', 'nhl-year-slider'],
        resetIds: ['designation-year-reset', 'nhl-year-reset'],
        modeIds: ['designation-year-mode']
    }
};

const YEAR_SLIDER_MIN = YEAR_FIELD_OPTIONS.formYear.min;
let currentYearFieldKey = YEAR_FIELD_OPTIONS.formYear.key;

function getYearFieldOption(key = currentYearFieldKey) {
    return YEAR_FIELD_OPTIONS[key] || YEAR_FIELD_OPTIONS.formYear;
}

function getCurrentYearField() {
    return getYearFieldOption();
}

function firstElementById(ids = []) {
    for (const id of ids) {
        const element = document.getElementById(id);
        if (element) return element;
    }
    return null;
}

function parseSliderValues(raw) {
    const values = Array.isArray(raw) ? raw : [raw];
    return values.map(value => parseInt(value, 10));
}

function getYearSliderRange(yearSlider) {
    if (!yearSlider?.noUiSlider) return null;
    return parseSliderValues(yearSlider.noUiSlider.get());
}

function clampYear(value, field) {
    return Math.min(field.max, Math.max(field.min, Math.round(value)));
}

// creates one configurable range or specific year slider
function createYearSlider(field, onDraftChange) {
    const element = firstElementById(field.elementIds);
    if (!element || typeof noUiSlider === 'undefined') return null;

    let mode = 'range';
    let tooltipInputs = [];
    const modeToggle = firstElementById(field.modeIds);
    const reset = firstElementById(field.resetIds);

    function isSpecific() {
        return mode === 'specific';
    }

    function range() {
        const values = getYearSliderRange(element);
        if (!values || !values.length) return [field.min, field.max];
        if (isSpecific()) {
            const year = values[0];
            return [year, year];
        }
        return values.length === 1 ? [values[0], values[0]] : values;
    }

    // mirrors slider values into editable handle inputs without interrupting typing
    function syncInputs() {
        const values = range();
        tooltipInputs.forEach((input, index) => {
            if (!input || document.activeElement === input) return;
            input.value = isSpecific() ? values[0] : values[index];
        });
    }

    // validates typed years and keeps range handles from crossing
    function commitInput(input, index) {
        const value = input.value.trim();
        const number = /^\d+$/.test(value) ? Number(value) : NaN;
        if (!Number.isInteger(number) || number < field.min || number > field.max) {
            input.value = isSpecific() ? range()[0] : range()[index];
            return;
        }

        if (isSpecific()) {
            element.noUiSlider.set(number);
            return;
        }

        let [minimum, maximum] = range();
        if (index === 0) {
            minimum = number;
            maximum = Math.max(maximum, number);
        } else {
            maximum = number;
            minimum = Math.min(minimum, number);
        }
        element.noUiSlider.set([minimum, maximum]);
    }

    // adds accessible editable year inputs to each slider handle
    function setupTooltips() {
        tooltipInputs = [];
        element.querySelectorAll('.noUi-handle').forEach((handle, index) => {
            const tooltip = document.createElement('div');
            const input = document.createElement('input');
            tooltip.className = 'noUi-tooltip';
            input.className = 'year-tooltip-input';
            input.type = 'text';
            input.inputMode = 'numeric';
            const label = isSpecific()
                ? field.label
                : `${index === 0 ? 'Minimum' : 'Maximum'} ${field.label.toLowerCase()}`;
            input.setAttribute('aria-label', label);

            ['pointerdown', 'mousedown', 'touchstart', 'click'].forEach(eventName => {
                input.addEventListener(eventName, event => event.stopPropagation());
            });
            input.addEventListener('focus', () => input.select());
            input.addEventListener('keydown', event => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    commitInput(input, index);
                    input.blur();
                } else if (event.key === 'Escape') {
                    input.value = isSpecific() ? range()[0] : range()[index];
                    input.blur();
                }
            });
            input.addEventListener('blur', () => commitInput(input, index));
            tooltip.appendChild(input);
            handle.appendChild(tooltip);
            tooltipInputs[index] = input;
        });
    }

    // binds events after each slider rebuild
    function bindSliderEvents() {
        element.noUiSlider.off('.filterPanel');
        element.noUiSlider.on('update.filterPanel', syncInputs);

        if (typeof onDraftChange === 'function') {
            // set catches slider and typed input changes without firing during setup
            element.noUiSlider.on('set.filterPanel', onDraftChange);
        }
        syncInputs();
    }

    function updateAriaLabel() {
        element.setAttribute(
            'aria-label',
            isSpecific() ? `${field.label} specific year` : `${field.label} range`
        );
    }

    // rebuilds the slider when its mode changes
    function buildSlider(start) {
        if (element.noUiSlider) element.noUiSlider.destroy();
        tooltipInputs = [];

        const specific = isSpecific();
        const startValue = specific
            ? [clampYear(start[0] ?? start, field)]
            : [clampYear(start[0], field), clampYear(start[1] ?? start[0], field)];

        element.classList.toggle('is-specific', specific);
        updateAriaLabel();

        // range mode has two connected handles while specific mode has one
        noUiSlider.create(element, {
            start: specific ? startValue[0] : startValue,
            step: 1,
            range: { min: field.min, max: field.max },
            connect: specific ? false : true,
            tooltips: false,
            behaviour: specific ? 'tap-drag' : 'drag',
            format: {
                to: value => Math.round(value),
                from: value => Number(value)
            }
        });

        setupTooltips();
        bindSliderEvents();
    }

    // switches between an inclusive range and one selected year
    function setMode(nextMode, { preserveValue = true } = {}) {
        const next = nextMode === 'specific' ? 'specific' : 'range';
        if (next === mode && element.noUiSlider) {
            if (modeToggle) modeToggle.checked = next === 'specific';
            return;
        }

        const current = element.noUiSlider ? range() : [field.min, field.max];
        mode = next;
        if (modeToggle) modeToggle.checked = mode === 'specific';

        if (mode === 'specific') {
            // use the midpoint so a collapsed range has a predictable selected year
            const year = preserveValue
                ? clampYear(Math.round((current[0] + current[1]) / 2), field)
                : clampYear(Math.round((field.min + field.max) / 2), field);
            buildSlider([year, year]);
        } else {
            buildSlider(preserveValue && current[0] !== current[1] ? current : [field.min, field.max]);
        }

        if (typeof onDraftChange === 'function') onDraftChange();
    }

    // restores the full field range and its two handle mode
    function resetSlider() {
        mode = 'range';
        if (modeToggle) modeToggle.checked = false;
        buildSlider([field.min, field.max]);
        if (typeof onDraftChange === 'function') onDraftChange();
    }

    buildSlider([field.min, field.max]);

    if (modeToggle && !modeToggle.dataset.filterSliderModeInitialized) {
        modeToggle.dataset.filterSliderModeInitialized = 'true';
        modeToggle.checked = false;
        modeToggle.addEventListener('change', () => {
            setMode(modeToggle.checked ? 'specific' : 'range');
        });
    }

    if (reset && !reset.dataset.filterSliderInitialized) {
        reset.dataset.filterSliderInitialized = 'true';
        reset.addEventListener('click', resetSlider);
    }

    return {
        element,
        getRange: range,
        getMode: () => mode,
        setMode,
        reset: resetSlider,
        setRange(values) {
            const next = values || [field.min, field.max];
            if (isSpecific()) {
                const year = clampYear(next[0], field);
                element.noUiSlider.set(year);
            } else {
                element.noUiSlider.set([clampYear(next[0], field), clampYear(next[1] ?? next[0], field)]);
            }
        }
    };
}

// creates both independent year filters for the filter panel
function setupFilterYearSliders({ onDraftChange } = {}) {
    const sliders = {};
    Object.values(YEAR_FIELD_OPTIONS).forEach(field => {
        sliders[field.key] = createYearSlider(field, onDraftChange);
    });

    return {
        elements: Object.fromEntries(
            Object.entries(sliders).map(([key, slider]) => [key, slider?.element || null])
        ),
        controllers: sliders,
        getRanges() {
            const ranges = {};
            Object.values(YEAR_FIELD_OPTIONS).forEach(field => {
                ranges[field.key] = sliders[field.key]?.getRange() || [field.min, field.max];
            });
            return ranges;
        },
        setRanges(ranges = {}) {
            Object.values(YEAR_FIELD_OPTIONS).forEach(field => {
                const slider = sliders[field.key];
                if (!slider) return;
                slider.setRange(ranges[field.key] || [field.min, field.max]);
            });
        },
        reset() {
            Object.values(YEAR_FIELD_OPTIONS).forEach(field => {
                sliders[field.key]?.reset();
            });
        }
    };
}

// keeps older single slider callers working during the panel transition
function setupYearSliderPanel() {
    return setupFilterYearSliders().elements.formYear;
}

function isFullYearSliderRange(yearSlider, fieldKey = currentYearFieldKey) {
    const field = getYearFieldOption(fieldKey);
    const range = getYearSliderRange(yearSlider);
    if (!range) return true;
    const minimum = range[0];
    const maximum = range[1] ?? range[0];
    return minimum === field.min && maximum === field.max;
}

function onYearSliderUpdate(yearSlider, callback) {
    if (yearSlider?.noUiSlider) yearSlider.noUiSlider.on('update', callback);
}

window.setupFilterYearSliders = setupFilterYearSliders;
