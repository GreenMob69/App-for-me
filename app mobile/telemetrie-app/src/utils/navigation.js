'use strict';

/**
 * Returnează navigator-ul rădăcină, indiferent de adâncimea de nesting.
 * Înlocuiește getParent().getParent()... hardcodat.
 */
export function getRootNavigation(navigation) {
    if (!navigation) return null;
    let current = navigation;
    while (current.getParent?.()) {
        current = current.getParent();
    }
    return current;
}
