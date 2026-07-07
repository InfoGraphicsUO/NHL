// hover info box is our custom tooltip
// two main fields: header and info text

function createHoverInfoBox(options = {}) {
    const offsetX = options.offsetX ?? 0; // in pixels
    const offsetY = options.offsetY ?? -12; // in pixels
    const viewportPadding = options.viewportPadding ?? 8; // in pixels
    const container = options.container || document.body; // DOM element

    const element = document.createElement('div');
    element.className = 'hover-info-box';
    element.hidden = true;
    element.setAttribute('role', 'tooltip');
    container.appendChild(element); // append to body by default

    function appendTextBlock(className, text) {
        if (text === undefined || text === null || text === '') {
            return;
        }

        const block = document.createElement('div');
        block.className = className;
        block.textContent = String(text);
        element.appendChild(block);
    }

    function setPosition(clientX, clientY) {
        if (element.hidden) {
            return;
        }

        const box = element.getBoundingClientRect(); // get the bounding client rect of the element
        const maxLeft = window.innerWidth - box.width - viewportPadding;
        const maxTop = window.innerHeight - box.height - viewportPadding;
        const targetLeft = clientX + offsetX - box.width / 2;
        const targetTop = clientY + offsetY - box.height;
        const clampedLeft = Math.min(Math.max(targetLeft, viewportPadding), Math.max(maxLeft, viewportPadding));
        const clampedTop = Math.min(Math.max(targetTop, viewportPadding), Math.max(maxTop, viewportPadding));

        element.style.left = `${clampedLeft}px`; // set the left position of the element
        element.style.top = `${clampedTop}px`; // set the top position of the element
    }

    return {
        show({ header, infoText, infoLines } = {}) {
            element.replaceChildren(); // clear any existing content
            appendTextBlock('hover-info-box__header', header); // add header text

            if (Array.isArray(infoLines)) {
                infoLines.forEach(line => appendTextBlock('hover-info-box__info', line)); // add info lines
            } else {
                appendTextBlock('hover-info-box__info', infoText);
            }

            element.hidden = false;
        },
        hide() {
            element.hidden = true;
            element.replaceChildren();
        },
        setPosition
    };
}
