// category fields stored as string flags in the source data
const MODE_FIELDS = ['Acknowledged', 'Multiculturalism', 'Valorization', 'Erasure'];
const SUPREMACY_FIELDS = [
    'Colonization',
    'Nation_Building',
    'Settler_Colonization',
    'Slavery',
    'State_Formation',
    'Racial_Capitalism'
];

// source values that need a public facing state / territory name
// aliases (full names and codes) share one label so State/Territory sort groups correctly
const STATE_NAMES = {
    AL: 'Alabama',
    AK: 'Alaska',
    AS: 'American Samoa',
    'AMERICAN SAMOA': 'American Samoa',
    AZ: 'Arizona',
    AR: 'Arkansas',
    CA: 'California',
    CO: 'Colorado',
    CT: 'Connecticut',
    DE: 'Delaware',
    DC: 'District of Columbia',
    FL: 'Florida',
    GA: 'Georgia',
    GU: 'Guam',
    HI: 'Hawaii',
    ID: 'Idaho',
    IL: 'Illinois',
    IN: 'Indiana',
    IA: 'Iowa',
    KS: 'Kansas',
    KY: 'Kentucky',
    LA: 'Louisiana',
    ME: 'Maine',
    MD: 'Maryland',
    MH: 'Marshall Islands',
    'MARSHALL ISLANDS': 'Marshall Islands',
    MA: 'Massachusetts',
    MI: 'Michigan',
    FM: 'Federated States of Micronesia',
    'FED. STATES': 'Federated States of Micronesia',
    MN: 'Minnesota',
    MS: 'Mississippi',
    MO: 'Missouri',
    MT: 'Montana',
    NE: 'Nebraska',
    NV: 'Nevada',
    NH: 'New Hampshire',
    NJ: 'New Jersey',
    NM: 'New Mexico',
    NY: 'New York',
    NC: 'North Carolina',
    ND: 'North Dakota',
    MP: 'Northern Mariana Islands',
    'N. MARIANA ISLANDS': 'Northern Mariana Islands',
    OH: 'Ohio',
    OK: 'Oklahoma',
    OR: 'Oregon',
    PW: 'Palau',
    PALAU: 'Palau',
    PA: 'Pennsylvania',
    PR: 'Puerto Rico',
    RI: 'Rhode Island',
    SC: 'South Carolina',
    SD: 'South Dakota',
    TN: 'Tennessee',
    TX: 'Texas',
    UT: 'Utah',
    VT: 'Vermont',
    VI: 'U.S. Virgin Islands',
    'VIRGIN ISLANDS': 'U.S. Virgin Islands',
    'U.S. MINOR ISLANDS': 'U.S. Minor Outlying Islands',
    UM: 'U.S. Minor Outlying Islands',
    VA: 'Virginia',
    WA: 'Washington',
    WV: 'West Virginia',
    WI: 'Wisconsin',
    WY: 'Wyoming',
    MOROCCO: 'Morocco'
};

const COLLATOR = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

function toTitleCase(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/(^|[\s./&;,-])([a-z])/g, (_, boundary, letter) => boundary + letter.toUpperCase());
}

function displayValue(value) {
    const decoder = document.createElement('textarea');
    decoder.innerHTML = value;
    return decoder.value;
}

// normalizes state/territory codes and all-caps source values for display
function stateDisplayName(value) {
    const normalized = String(value || '').trim();
    if (!normalized) return '';
    const mapped = STATE_NAMES[normalized] || STATE_NAMES[normalized.toUpperCase()];
    if (mapped) return mapped;
    const decoded = displayValue(normalized);
    return /^[A-Z0-9][A-Z0-9\s./'-]*$/.test(decoded) ? toTitleCase(decoded) : decoded;
}

function comparePresentText(a, b) {
    const left = String(a || '').trim();
    const right = String(b || '').trim();
    if (!left || !right) return left ? -1 : right ? 1 : 0;
    return COLLATOR.compare(left, right);
}

// compares arbitrarily long digit-only IDs without losing precision or treating leading zeroes as significant
function compareReferenceIds(a, b) {
    const left = String(a || '').trim();
    const right = String(b || '').trim();
    if (!left || !right) return left ? -1 : right ? 1 : 0;
    const leftIsNumeric = /^\d+$/.test(left);
    const rightIsNumeric = /^\d+$/.test(right);
    if (leftIsNumeric && rightIsNumeric) {
        const normalizedLeft = left.replace(/^0+(?=\d)/, '');
        const normalizedRight = right.replace(/^0+(?=\d)/, '');
        return normalizedLeft.length - normalizedRight.length
            || normalizedLeft.localeCompare(normalizedRight)
            || left.length - right.length;
    }
    if (leftIsNumeric !== rightIsNumeric) return leftIsNumeric ? -1 : 1;
    return COLLATOR.compare(left, right);
}
