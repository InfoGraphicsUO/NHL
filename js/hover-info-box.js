// creates one reusable tooltip that can follow pointer or keyboard focus
function createHoverInfoBox(options = {}) {
    // offsets and viewport padding use css pixels
    const offsetX = options.offsetX ?? 0;
    const offsetY = options.offsetY ?? -12;
    const viewportPadding = options.viewportPadding ?? 8;
    const container = options.container || document.body;

    const element = document.createElement('div');
    element.className = 'hover-info-box';
    element.hidden = true;
    element.setAttribute('role', 'tooltip');
    container.appendChild(element);
    let hideTimer;

    // adds a text row only when the caller supplied content
    function appendTextBlock(className, text) {
        if (text === undefined || text === null || text === '') {
            return;
        }

        const block = document.createElement('div');
        block.className = className;
        block.textContent = String(text);
        element.appendChild(block);
    }

    // centers the tooltip above its target without letting it leave the viewport
    function setPosition(clientX, clientY) {
        if (element.hidden) {
            return;
        }

        const box = element.getBoundingClientRect();
        const maxLeft = window.innerWidth - box.width - viewportPadding;
        const maxTop = window.innerHeight - box.height - viewportPadding;
        const targetLeft = clientX + offsetX - box.width / 2;
        const targetTop = clientY + offsetY - box.height;
        const clampedLeft = Math.min(Math.max(targetLeft, viewportPadding), Math.max(maxLeft, viewportPadding));
        const clampedTop = Math.min(Math.max(targetTop, viewportPadding), Math.max(maxTop, viewportPadding));

        element.style.left = `${clampedLeft}px`;
        element.style.top = `${clampedTop}px`;
    }

    return {
        show({ header, infoText, infoLines } = {}) {
            clearTimeout(hideTimer);
            element.replaceChildren();
            appendTextBlock('hover-info-box__header', header);

            if (Array.isArray(infoLines)) {
                infoLines.forEach(line => appendTextBlock('hover-info-box__info', line));
            } else {
                appendTextBlock('hover-info-box__info', infoText);
            }

            element.hidden = false;
            requestAnimationFrame(() => element.classList.add('is-visible'));
        },
        hide() {
            clearTimeout(hideTimer);
            element.classList.remove('is-visible');

            // keep this 100 ms delay aligned with the css tooltip fade duration
            hideTimer = setTimeout(() => {
                if (!element.classList.contains('is-visible')) {
                    element.hidden = true;
                    element.replaceChildren();
                }
            }, 100);
        },
        setPosition
    };
}
