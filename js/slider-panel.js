const YEAR_SLIDER_MIN = 1950;
const YEAR_SLIDER_MAX = 2026;

function setupYearSliderPanel() {
    const yearSlider = document.getElementById('year-slider');
    const yearReset = document.getElementById('year-reset');

    if (!yearSlider) {
        console.warn('Year slider element not found');
        return null;
    }

    noUiSlider.create(yearSlider, {
        // initialize slider using noUiSlider
        start: [YEAR_SLIDER_MIN, YEAR_SLIDER_MAX],
        step: 1,
        range: {
            min: YEAR_SLIDER_MIN,
            max: YEAR_SLIDER_MAX
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

    function parseValidYear(value) {
        const trimmedValue = value.trim();
        if (!/^\d+$/.test(trimmedValue)) {
            return null;
        }

        const year = Number(trimmedValue);
        if (!Number.isInteger(year) || year < YEAR_SLIDER_MIN || year > YEAR_SLIDER_MAX) {
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
            input.setAttribute('aria-label', index === 0 ? 'Minimum form year' : 'Maximum form year');

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

        syncYearTooltipInputs();
    }

    setupYearTooltipInputs();
    yearSlider.noUiSlider.on('update', syncYearTooltipInputs);

    if (yearReset) {
        yearReset.addEventListener('click', function() {
            yearSlider.noUiSlider.set([YEAR_SLIDER_MIN, YEAR_SLIDER_MAX]);
        });
    }

    return yearSlider;
}

function getYearSliderRange(yearSlider) {
    return yearSlider.noUiSlider.get().map(value => parseInt(value, 10));
}

function onYearSliderUpdate(yearSlider, callback) {
    yearSlider.noUiSlider.on('update', callback);
}
