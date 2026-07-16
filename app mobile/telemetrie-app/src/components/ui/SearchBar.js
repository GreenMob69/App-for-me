/**
 * SearchBar — câmp de căutare dedicat cu buton de ștergere.
 *
 * Responsabilitate: input specializat pentru filtrare și căutare în liste.
 * Afișează icon de căutare la stânga, buton X când există text,
 * și opțional un buton de filtru dacă onFilter este furnizat.
 *
 * @prop {string}   value          valoarea curentă (required)
 * @prop {function} onChangeText   callback la modificare (required)
 * @prop {string}   placeholder    default: 'Caută...'
 * @prop {function} onClear        callback la apăsare X; dacă nu e furnizat, curăță singur
 * @prop {function} onFilter       dacă e furnizat, apare icon filter la dreapta
 * @prop {boolean}  autoFocus
 * @prop {boolean}  filterActive   marchează icon-ul filter ca activ
 * @prop {object}   style          override pentru container
 * @prop {string}   testID
 */

import React, { useState, useCallback } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { colors, typography, radii, spacing } from '../../theme';

const SearchBar = React.memo(({
    value,
    onChangeText,
    placeholder = 'Caută...',
    onClear,
    onFilter,
    autoFocus = false,
    filterActive = false,
    style,
    testID,
}) => {
    const [focused, setFocused] = useState(false);

    const handleClear = useCallback(() => {
        if (onClear) {
            onClear();
        } else {
            onChangeText('');
        }
    }, [onClear, onChangeText]);

    return (
        <View style={[styles.container, focused && styles.containerFocused, style]}>
            <Text style={styles.searchIcon}>⌕</Text>

            <TextInput
                style={styles.input}
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder}
                placeholderTextColor={colors.text.disabled}
                autoFocus={autoFocus}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                returnKeyType="search"
                autoCapitalize="none"
                autoCorrect={false}
                testID={testID}
                accessibilityLabel={placeholder}
                accessibilityRole="search"
            />

            {value.length > 0 && (
                <TouchableOpacity
                    style={styles.clearBtn}
                    onPress={handleClear}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityLabel="Șterge căutarea"
                    accessibilityRole="button"
                >
                    <Text style={styles.clearIcon}>✕</Text>
                </TouchableOpacity>
            )}

            {onFilter && (
                <>
                    <View style={styles.filterSep} />
                    <TouchableOpacity
                        style={[styles.filterBtn, filterActive && styles.filterBtnActive]}
                        onPress={onFilter}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityLabel="Filtre"
                        accessibilityRole="button"
                    >
                        <Text style={[styles.filterIcon, filterActive && styles.filterIconActive]}>⊟</Text>
                    </TouchableOpacity>
                </>
            )}
        </View>
    );
});

SearchBar.displayName = 'SearchBar';

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.bg[1],
        borderWidth: 1,
        borderColor: colors.border.default,
        borderRadius: radii.md,
        paddingHorizontal: spacing[3],
        height: 44,
    },
    containerFocused: {
        borderColor: colors.accent.default,
        backgroundColor: colors.bg[2],
    },

    searchIcon: {
        fontSize: typography.sizes.body1,
        color: colors.text.tertiary,
        marginRight: spacing[2],
    },

    input: {
        flex: 1,
        color: colors.text.primary,
        fontSize: typography.sizes.body2,
        paddingVertical: spacing[2],
    },

    clearBtn: {
        padding: spacing[1],
        marginLeft: spacing[1],
    },
    clearIcon: {
        fontSize: typography.sizes.caption,
        color: colors.text.secondary,
    },

    filterSep: {
        width: 1,
        height: 18,
        backgroundColor: colors.border.default,
        marginHorizontal: spacing[2],
    },
    filterBtn: {
        padding: spacing[1],
    },
    filterBtnActive: {},
    filterIcon: {
        fontSize: typography.sizes.body2,
        color: colors.text.secondary,
    },
    filterIconActive: {
        color: colors.accent.default,
    },
});

export default SearchBar;
