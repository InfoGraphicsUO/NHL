const YEAR_SLIDER_MAX = 2026; // this is the same for each year field for consistency
// as of 2026
// form year actual range: 1957 - 2012 
// year designated actual range: 1937 - 2024

const YEAR_FIELD_OPTIONS = {
    formYear: {
        key: 'formYear',
        label: 'Form Year',
        property: 'Form Year',
        min: 1950,
        max: YEAR_SLIDER_MAX,
        excludeMultiple: true,
        ariaName: 'form year'
    },
    nhlYear: {
        key: 'nhlYear',
        label: 'Year Designated',
        property: 'NHL_Year',
        min: 1937,
        max: YEAR_SLIDER_MAX,
        excludeMultiple: false,
        ariaName: 'year designated'
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

function setupYearSliderPanel() {
    const yearSlider = document.getElementById('year-slider');
    const yearReset = document.getElementById('year-reset');
    const yearFieldPicker = document.getElementById('year-field-picker');
    const initialField = getCurrentYearField();

    if (!yearSlider) {
        console.warn('Year slider element not found');
        return null;
    }

    noUiSlider.create(yearSlider, {
        // initialize slider using noUiSlider
        start: [initialField.min, initialField.max],
        step: 1,
        range: {
            min: initialField.min,
            max: initialField.max
        },
        connect: true,
        tooltips: false,
        behaviour: 'drag',
        format: {
            to: value => Math.round(value),
            from: value => Number(value)
        }
    });

    const yearTooltipInputs = [];

    function getCurrentSliderYears() {
        return getYearSliderRange(yearSlider);
    }

    function syncYearTooltipInputs() {
        // sync the year tooltip inputs with the slider values
        const values = getCurrentSliderYears();
        yearTooltipInputs.forEach((input, index) => {
            if (document.activeElement !== input) {
                input.value = values[index];
            }
        });
    }

    function updateYearTooltipAriaLabels() {
        const field = getCurrentYearField();
        yearTooltipInputs.forEach((input, index) => {
            if (!input) return;
            input.setAttribute(
                'aria-label',
                index === 0 ? `Minimum ${field.ariaName}` : `Maximum ${field.ariaName}`
            );
        });
    }

    function parseValidYear(value) {
        const trimmedValue = value.trim();
        if (!/^\d+$/.test(trimmedValue)) {
            return null;
        }

        const field = getCurrentYearField();
        const year = Number(trimmedValue);
        if (!Number.isInteger(year) || year < field.min || year > field.max) {
            return null;
        }

        return year;
    }

    function commitYearTooltipInput(input, handleIndex) {
        // when user submits their year input, parse it and update the slider
        // users can commit using enter or by clicking outside of the div
        const selectedYear = parseValidYear(input.value);
        const currentYears = getCurrentSliderYears();

        if (selectedYear === null) {
            // if the year is invalid, reset the input to the current slider value
            input.value = currentYears[handleIndex];
            return;
        }

        let [minYear, maxYear] = currentYears;
        if (handleIndex === 0) {
            // if the user is adjusting the minimum year, update the minimum year
            minYear = selectedYear;
            if (selectedYear > maxYear) {
                maxYear = selectedYear;
            }
        } else {
            // if the user is adjusting the maximum year, update the maximum year
            maxYear = selectedYear;
            if (selectedYear < minYear) {
                minYear = selectedYear;
            }
        }

        yearSlider.noUiSlider.set([minYear, maxYear]);
    }

    function setupYearTooltipInputs() {
        // users can input years directly into the slider by clicking on the year tooltip
        yearSlider.querySelectorAll('.noUi-handle').forEach((handle, index) => {
            const tooltip = document.createElement('div');
            const input = document.createElement('input');

            tooltip.className = 'noUi-tooltip';
            input.className = 'year-tooltip-input';
            input.type = 'text';
            input.inputMode = 'numeric';

            ['pointerdown', 'mousedown', 'touchstart', 'click'].forEach(eventName => {
                input.addEventListener(eventName, event => event.stopPropagation());
            });

            input.addEventListener('focus', () => input.select());
            input.addEventListener('keydown', event => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    commitYearTooltipInput(input, index);
                    input.blur();
                } else if (event.key === 'Escape') {
                    input.value = getCurrentSliderYears()[index];
                    input.blur();
                }
            });
            input.addEventListener('blur', () => commitYearTooltipInput(input, index));

            tooltip.appendChild(input);
            handle.appendChild(tooltip);
            yearTooltipInputs[index] = input;
        });

        updateYearTooltipAriaLabels();
        syncYearTooltipInputs();
    }

    function syncYearFieldPickerWidth() {
        // helps ensure the year field picker is the correct width
        if (!yearFieldPicker) return;

        const selectedOption = yearFieldPicker.options[yearFieldPicker.selectedIndex];
        if (!selectedOption) return;

        const measure = document.createElement('span');
        const styles = getComputedStyle(yearFieldPicker);

        measure.textContent = selectedOption.text;
        measure.style.cssText = [
            'position:absolute',
            'visibility:hidden',
            'white-space:nowrap',
            `font:${styles.font}`,
            `letter-spacing:${styles.letterSpacing}`,
            `text-transform:${styles.textTransform}`
        ].join(';');

        document.body.appendChild(measure);
        // size select to the selected label text only; icon sits beside it
        yearFieldPicker.style.width = `${Math.ceil(measure.getBoundingClientRect().width) + 4}px`;
        measure.remove();
    }

    function clampYearToFieldRange(year, field) {
        return Math.min(field.max, Math.max(field.min, year));
    }

    function applyYearField(fieldKey) {
        // applies the year field to the slider
        const field = getYearFieldOption(fieldKey);
        const [currentMinYear, currentMaxYear] = getCurrentSliderYears();
        currentYearFieldKey = field.key;

        if (yearFieldPicker && yearFieldPicker.value !== field.key) {
            yearFieldPicker.value = field.key;
        }

        syncYearFieldPickerWidth();
        updateYearTooltipAriaLabels();

        // preserve the user's range when switching fields; clamp only if out of range
        let nextMinYear = clampYearToFieldRange(currentMinYear, field);
        let nextMaxYear = clampYearToFieldRange(currentMaxYear, field);
        if (nextMinYear > nextMaxYear) {
            nextMaxYear = nextMinYear;
        }

        yearSlider.noUiSlider.updateOptions({
            range: {
                min: field.min,
                max: field.max
            },
            start: [nextMinYear, nextMaxYear]
        });
    }

    setupYearTooltipInputs();
    yearSlider.noUiSlider.on('update', syncYearTooltipInputs);

    if (yearFieldPicker) {
        // initialize the year field picker with the initial field
        yearFieldPicker.value = initialField.key;
        syncYearFieldPickerWidth(); // ensure the year field picker is the correct width
        yearFieldPicker.addEventListener('change', () => {
            applyYearField(yearFieldPicker.value); // apply the year field to the slider
        });
    }

    if (yearReset) {
        yearReset.addEventListener('click', function() {
            const field = getCurrentYearField();
            yearSlider.noUiSlider.set([field.min, field.max]);
        });
    }

    return yearSlider;
}

function getYearSliderRange(yearSlider) {
    return yearSlider.noUiSlider.get().map(value => parseInt(value, 10));
}

function isFullYearSliderRange(yearSlider) {
    // checks if the slider is at the full range of the current year field
    const field = getCurrentYearField();
    const [minYear, maxYear] = getYearSliderRange(yearSlider);
    return minYear === field.min && maxYear === field.max;
}

function onYearSliderUpdate(yearSlider, callback) {
    yearSlider.noUiSlider.on('update', callback);
}
