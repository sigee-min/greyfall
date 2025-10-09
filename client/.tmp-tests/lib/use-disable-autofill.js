import { useEffect, useRef } from 'react';
const DATA_KEY_STATUS = 'greyfallAutocomplete';
const DATA_KEY_SECTION = 'greyfallAutocompleteSection';
const SECTION_PREFIX = 'greyfall';
function asElement(node) {
    return node.nodeType === Node.ELEMENT_NODE;
}
function forEachTarget(root, callback) {
    if (root instanceof HTMLFormElement || root instanceof HTMLInputElement || root instanceof HTMLTextAreaElement) {
        callback(root);
    }
    const matches = root.querySelectorAll('form, input, textarea');
    matches.forEach((element) => {
        if (element instanceof HTMLFormElement || element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
            callback(element);
        }
    });
}
function disableAutofill(element, { nextSectionId }) {
    if (element instanceof HTMLFormElement) {
        if (element.getAttribute('autocomplete') !== 'off') {
            element.setAttribute('autocomplete', 'off');
        }
        if (element.dataset[DATA_KEY_STATUS] !== 'applied') {
            element.dataset[DATA_KEY_STATUS] = 'applied';
        }
        return;
    }
    let section = element.dataset[DATA_KEY_SECTION];
    if (!section) {
        section = nextSectionId();
        element.dataset[DATA_KEY_SECTION] = section;
    }
    const desiredAutocomplete = `${section} off`;
    if (element.getAttribute('autocomplete') !== desiredAutocomplete) {
        element.setAttribute('autocomplete', desiredAutocomplete);
    }
    if (element.getAttribute('autocorrect') !== 'off') {
        element.setAttribute('autocorrect', 'off');
    }
    if (element.getAttribute('autocapitalize') !== 'off') {
        element.setAttribute('autocapitalize', 'off');
    }
    if (element.getAttribute('spellcheck') !== 'false') {
        element.setAttribute('spellcheck', 'false');
    }
    if (element.getAttribute('aria-autocomplete') !== 'none') {
        element.setAttribute('aria-autocomplete', 'none');
    }
    // Aggressively prevent history suggestions by de-identifying field name
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        const input = element;
        const type = (input.type || 'text').toLowerCase();
        // Only apply to text-like inputs; skip range/checkbox/radio etc.
        const textLike = ['text', 'search', 'email', 'url', 'tel', 'password', 'number'];
        if (textLike.includes(type)) {
            const original = input.getAttribute('name');
            if (original && !input.dataset.originalName) {
                input.dataset.originalName = original;
            }
            const anon = `${section}-name`;
            if (input.getAttribute('name') !== anon) {
                input.setAttribute('name', anon);
            }
        }
    }
    if (element.dataset[DATA_KEY_STATUS] !== 'applied') {
        element.dataset[DATA_KEY_STATUS] = 'applied';
    }
}
export function useDisableAutofill() {
    const counterRef = useRef(0);
    useEffect(() => {
        if (typeof document === 'undefined')
            return;
        const nextSectionId = () => {
            counterRef.current += 1;
            return `section-${SECTION_PREFIX}-${counterRef.current.toString(36)}`;
        };
        const applyToTree = (root) => {
            forEachTarget(root, (element) => disableAutofill(element, { nextSectionId }));
        };
        applyToTree(document);
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'attributes') {
                    const target = mutation.target;
                    if (asElement(target)) {
                        forEachTarget(target, (element) => disableAutofill(element, { nextSectionId }));
                    }
                    continue;
                }
                mutation.addedNodes.forEach((node) => {
                    if (!asElement(node))
                        return;
                    applyToTree(node);
                });
            }
        });
        observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
        return () => observer.disconnect();
    }, []);
}
